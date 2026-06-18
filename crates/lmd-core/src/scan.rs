//! Body scanner: extracts anchors and edges from the verbatim Markdown body.
//!
//! This is deliberately not a full Markdown AST. lmd-core's job is to maintain
//! the *link graph*, not to re-render prose, so the scanner walks the body
//! line-by-line (tracking fenced-code state) and pulls out the three escape-tag
//! kinds plus the visible Markdown links that point at lmd addresses.

use crate::address::{parse_address, Address};
use crate::model::NodeKind;
use once_cell::sync::Lazy;
use regex::Regex;

static RE_ANCHOR: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"<!--lmd:a\s+([a-z][a-z0-9-]*)(?:\s+rev=(\d+))?\s*-->").unwrap());
static RE_REL: Lazy<Regex> = Lazy::new(|| Regex::new(r"<!--lmd:rel\s+(.*?)\s*-->").unwrap());
static RE_REF: Lazy<Regex> = Lazy::new(|| Regex::new(r"<!--lmd:ref\b(.*?)-->").unwrap());
static RE_LINK: Lazy<Regex> = Lazy::new(|| Regex::new(r"\[[^\]]*\]\(([^)\s]+)\)").unwrap());
static RE_REL_PAIR: Lazy<Regex> = Lazy::new(|| Regex::new(r"([a-z_]+)=([^\s]+)").unwrap());
static RE_REF_REL: Lazy<Regex> = Lazy::new(|| Regex::new(r"\brel=([a-z_]+)").unwrap());

/// An `<!--lmd:a slug-->` anchor and the block it tags.
#[derive(Debug, Clone, PartialEq)]
pub struct Anchor {
    pub slug: String,
    pub rev: u32,
    pub kind: NodeKind,
    pub line: usize,
    /// Visible text of the anchored line (escape comments stripped, trimmed).
    pub text: String,
}

/// A raw outbound edge before resolution. `from` is the nearest preceding anchor
/// slug, or `None` if the tag appeared before any anchor (a diagnostic).
#[derive(Debug, Clone, PartialEq)]
pub struct RawEdge {
    pub from: Option<String>,
    pub rel: String,
    pub to: String,
    pub line: usize,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Scan {
    pub anchors: Vec<Anchor>,
    pub edges: Vec<RawEdge>,
}

fn strip_comments(line: &str) -> String {
    // Remove any lmd escape comment so only the visible text remains.
    let mut out = line.to_string();
    for re in [&*RE_ANCHOR, &*RE_REL, &*RE_REF] {
        out = re.replace_all(&out, "").to_string();
    }
    out.trim().to_string()
}

fn classify(line: &str, prev_was_fence_close: bool) -> NodeKind {
    let t = line.trim_start();
    if prev_was_fence_close {
        return NodeKind::Code;
    }
    if t.starts_with('#') {
        NodeKind::Heading
    } else if is_hr(t) {
        NodeKind::Hr
    } else if t.starts_with("![") {
        NodeKind::Image
    } else if t.starts_with('>') {
        NodeKind::Quote
    } else if t.starts_with('|') {
        NodeKind::TableRow
    } else if is_list_item(t) {
        NodeKind::ListItem
    } else {
        NodeKind::Para
    }
}

fn is_hr(t: &str) -> bool {
    let t = t.trim_end();
    (t.len() >= 3)
        && (t.chars().all(|c| c == '-')
            || t.chars().all(|c| c == '*')
            || t.chars().all(|c| c == '_'))
}

fn is_list_item(t: &str) -> bool {
    if let Some(rest) = t.strip_prefix(['-', '*', '+']) {
        return rest.starts_with(' ');
    }
    // ordered: digits then '.'
    let digits: String = t.chars().take_while(|c| c.is_ascii_digit()).collect();
    !digits.is_empty() && t[digits.len()..].starts_with(". ")
}

/// Scan a body string into anchors and raw edges.
pub fn scan(body: &str) -> Scan {
    let mut out = Scan::default();
    let mut in_fence = false;
    let mut prev_fence_close = false;
    let mut last_slug: Option<String> = None;

    for (i, line) in body.lines().enumerate() {
        let line_no = i + 1;
        let trimmed = line.trim_start();
        let is_fence = trimmed.starts_with("```") || trimmed.starts_with("~~~");

        if is_fence {
            if in_fence {
                in_fence = false;
                prev_fence_close = true;
                continue;
            } else {
                in_fence = true;
                prev_fence_close = false;
                continue;
            }
        }

        if in_fence {
            prev_fence_close = false;
            continue;
        }

        // Anchor(s) on this line.
        if let Some(cap) = RE_ANCHOR.captures(line) {
            let slug = cap[1].to_string();
            let rev = cap
                .get(2)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(1);
            let kind = classify(line, prev_fence_close);
            out.anchors.push(Anchor {
                slug: slug.clone(),
                rev,
                kind,
                line: line_no,
                text: strip_comments(line),
            });
            last_slug = Some(slug);
        }

        // Invisible semantic links: <!--lmd:rel role=addr,addr role2=addr-->.
        if let Some(cap) = RE_REL.captures(line) {
            for pair in RE_REL_PAIR.captures_iter(&cap[1]) {
                let role = pair[1].to_string();
                for addr in pair[2].split(',') {
                    let addr = addr.trim();
                    if addr.is_empty() {
                        continue;
                    }
                    out.edges.push(RawEdge {
                        from: last_slug.clone(),
                        rel: role.clone(),
                        to: addr.to_string(),
                        line: line_no,
                    });
                }
            }
        }

        // Visible refs: a Markdown link whose target is an lmd address, with an
        // optional trailing <!--lmd:ref rel=…--> to override the role.
        let ref_rel = RE_REF
            .captures(line)
            .and_then(|c| RE_REF_REL.captures(&c[1]).map(|m| m[1].to_string()))
            .unwrap_or_else(|| "related".to_string());
        for link in RE_LINK.captures_iter(line) {
            let target = link[1].to_string();
            if !matches!(parse_address(&target), Address::External(_)) {
                out.edges.push(RawEdge {
                    from: last_slug.clone(),
                    rel: ref_rel.clone(),
                    to: target,
                    line: line_no,
                });
            }
        }

        prev_fence_close = false;
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_anchor_and_edges() {
        let body = "## 회원 인증 <!--lmd:a cap-auth-->\n\n본문.\n<!--lmd:rel parent=:s2b impacts=design:uc-join,design:uc-approve-->\n\n[정책](policy:perf@2)<!--lmd:ref rel=policy-->";
        let s = scan(body);
        assert_eq!(s.anchors.len(), 1);
        assert_eq!(s.anchors[0].slug, "cap-auth");
        assert_eq!(s.anchors[0].kind, NodeKind::Heading);
        // parent + 2 impacts + 1 policy ref
        assert_eq!(s.edges.len(), 4);
        assert!(s
            .edges
            .iter()
            .any(|e| e.rel == "policy" && e.to == "policy:perf@2"));
        assert_eq!(s.edges.iter().filter(|e| e.rel == "impacts").count(), 2);
    }
}

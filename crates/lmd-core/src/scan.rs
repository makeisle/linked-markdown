//! Body scanner: extracts anchors and edges from the verbatim Markdown body.
//!
//! This is deliberately not a full Markdown AST. lmd-core's job is to maintain
//! the *link graph*, so the scanner walks the body line-by-line (tracking
//! fenced-code state) and pulls out the two escape-tag constructs:
//!
//! - an **anchor** `<!--lmd:a slug-->` marks a linkable target;
//! - a **ref** `<!--lmd:ref <targets>-->source text<!--/lmd-->` links its wrapped
//!   text to 1..N typed anchors. Only the opening tag matters for the graph; the
//!   `<!--/lmd-->` close just delimits the visible source text.

use crate::address::{parse_address, Address};
use crate::model::NodeKind;
use once_cell::sync::Lazy;
use regex::Regex;

static RE_ANCHOR: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"<!--lmd:a\s+([a-z][a-z0-9-]*)(?:\s+rev=(\d+))?\s*-->").unwrap());
static RE_REF_OPEN: Lazy<Regex> = Lazy::new(|| Regex::new(r"<!--lmd:ref\s+(.*?)\s*-->").unwrap());
static RE_REF_CLOSE: Lazy<Regex> = Lazy::new(|| Regex::new(r"<!--\s*/lmd\s*-->").unwrap());

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
/// slug, or `None` if the ref appeared before any anchor (a diagnostic).
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
    let mut out = line.to_string();
    for re in [&*RE_ANCHOR, &*RE_REF_OPEN, &*RE_REF_CLOSE] {
        out = re.replace_all(&out, "").to_string();
    }
    out.trim().to_string()
}

/// Parse a ref's `<targets>`: whitespace-separated items, each
/// `[role=]addr[,addr…]`. A bare address list takes the default role `related`.
fn parse_targets(s: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for item in s.split_whitespace() {
        let (role, addrs) = match item.split_once('=') {
            Some((r, a)) => (r.to_string(), a),
            None => ("related".to_string(), item),
        };
        for addr in addrs.split(',') {
            if !addr.is_empty() {
                out.push((role.clone(), addr.to_string()));
            }
        }
    }
    out
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
            in_fence = !in_fence;
            prev_fence_close = !in_fence;
            continue;
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

        // Ref(s): each opening tag lists 1..N typed targets.
        for cap in RE_REF_OPEN.captures_iter(line) {
            for (rel, addr) in parse_targets(&cap[1]) {
                if !matches!(parse_address(&addr), Address::External(_)) {
                    out.edges.push(RawEdge {
                        from: last_slug.clone(),
                        rel,
                        to: addr,
                        line: line_no,
                    });
                }
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
    fn extracts_anchor_and_ref_targets() {
        let body = "## 회원 인증 <!--lmd:a cap-auth-->\n\n본문 <!--lmd:ref parent=:s2b impacts=design:uc-join,design:uc-approve-->핵심<!--/lmd--> 문장.\n\n<!--lmd:ref policy=design:perf@2-->정책<!--/lmd-->";
        let s = scan(body);
        assert_eq!(s.anchors.len(), 1);
        assert_eq!(s.anchors[0].slug, "cap-auth");
        assert_eq!(s.anchors[0].kind, NodeKind::Heading);
        // parent + 2 impacts + 1 policy
        assert_eq!(s.edges.len(), 4);
        assert!(s
            .edges
            .iter()
            .any(|e| e.rel == "policy" && e.to == "design:perf@2"));
        assert_eq!(s.edges.iter().filter(|e| e.rel == "impacts").count(), 2);
        assert!(s
            .edges
            .iter()
            .all(|e| e.from.as_deref() == Some("cap-auth")));
    }

    #[test]
    fn bare_address_list_defaults_to_related() {
        let s = scan("## A <!--lmd:a a-->\n<!--lmd:ref :x,:y-->text<!--/lmd-->");
        assert_eq!(s.edges.len(), 2);
        assert!(s.edges.iter().all(|e| e.rel == "related"));
    }
}

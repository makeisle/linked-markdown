//! Address parsing and classification (`spec/SPEC.md` §5).
//!
//! An address is `[namespace:](slug | uuid)[@version]`, plus the local forms
//! `:slug` / `#slug` and the external `kg://uuid` escape hatch. Ordinary Markdown
//! link targets (`https://…`, `./file.md`) are classified as [`Address::External`]
//! and never become edges.

/// A classified link target.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Address {
    /// Same-document anchor: `:slug` or `#slug`.
    Local {
        slug: String,
        version: Option<String>,
    },
    /// Cross-document: `alias:target` where `target` is a slug or uuid.
    Cross {
        alias: String,
        target: String,
        version: Option<String>,
    },
    /// `kg://uuid` — an external knowledge-graph node reference.
    Kg { id: String },
    /// Anything that is not an lmd address (http(s), relative paths, …).
    External(String),
}

fn split_version(s: &str) -> (&str, Option<String>) {
    match s.rsplit_once('@') {
        Some((head, ver)) if !ver.is_empty() && !head.is_empty() => (head, Some(ver.to_string())),
        _ => (s, None),
    }
}

fn is_alias(s: &str) -> bool {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) if c.is_ascii_lowercase() => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Classify a raw link-target string.
pub fn parse_address(raw: &str) -> Address {
    let raw = raw.trim();

    if let Some(rest) = raw.strip_prefix("kg://") {
        return Address::Kg {
            id: rest.to_string(),
        };
    }
    if raw.contains("://") {
        return Address::External(raw.to_string());
    }
    if let Some(rest) = raw.strip_prefix(':').or_else(|| raw.strip_prefix('#')) {
        let (slug, version) = split_version(rest);
        if !slug.is_empty() {
            return Address::Local {
                slug: slug.to_string(),
                version,
            };
        }
        return Address::External(raw.to_string());
    }
    if let Some((alias, rest)) = raw.split_once(':') {
        let (target, version) = split_version(rest);
        if is_alias(alias) && !target.is_empty() {
            return Address::Cross {
                alias: alias.to_string(),
                target: target.to_string(),
                version,
            };
        }
    }
    Address::External(raw.to_string())
}

/// Parse the integer version out of a pin like `"@7"` or `"7"`.
pub fn parse_pin(pin: &str) -> Option<u32> {
    pin.trim_start_matches('@').parse::<u32>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_forms() {
        assert_eq!(
            parse_address(":cap-auth"),
            Address::Local {
                slug: "cap-auth".into(),
                version: None
            }
        );
        assert_eq!(
            parse_address("#cap-auth"),
            Address::Local {
                slug: "cap-auth".into(),
                version: None
            }
        );
        assert_eq!(
            parse_address("policy:perf@2"),
            Address::Cross {
                alias: "policy".into(),
                target: "perf".into(),
                version: Some("2".into())
            }
        );
        assert_eq!(parse_address("kg://abc"), Address::Kg { id: "abc".into() });
        assert!(matches!(
            parse_address("https://example.com"),
            Address::External(_)
        ));
        assert!(matches!(parse_address("./other.md"), Address::External(_)));
    }
}

//! Serialize a [`Doc`] back to canonical `.lmd` text (`spec/SPEC.md` §8).
//!
//! Canonical guarantees in v0.1:
//! - front-matter keys in struct-declaration order, `imports` alphabetical;
//! - manifest JSON pretty-printed (2-space), object keys in declared order,
//!   map keys alphabetical, `edges` sorted by `(from, rel, to)`;
//! - LF newlines, exactly one trailing newline.
//!
//! The body is emitted verbatim (its inner escape-comment spacing is not yet
//! re-normalized — that is a later refinement tracked by conformance).

use crate::error::{LmdError, Result};
use crate::model::Doc;

pub fn serialize(doc: &Doc) -> Result<String> {
    let yaml = serde_yaml::to_string(&doc.frontmatter)
        .map_err(|e| LmdError::Frontmatter(e.to_string()))?;

    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(&yaml);
    if !yaml.ends_with('\n') {
        out.push('\n');
    }
    out.push_str("---\n\n");
    out.push_str(doc.body.trim());
    out.push('\n');

    if let Some(manifest) = &doc.manifest {
        let mut m = manifest.clone();
        m.edges.sort_by(|a, b| {
            (a.from.as_str(), a.rel.as_str(), a.to.as_str()).cmp(&(
                b.from.as_str(),
                b.rel.as_str(),
                b.to.as_str(),
            ))
        });
        let json =
            serde_json::to_string_pretty(&m).map_err(|e| LmdError::Manifest(e.to_string()))?;
        out.push_str("\n<!--lmd:manifest\n");
        out.push_str(&json);
        out.push_str("\n-->\n");
    }

    Ok(out)
}

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

#[cfg(test)]
mod tests {
    // An import's `path` hint must survive parse → canonical serialize → parse.
    // (Regression guard: `path` was in the spec + TS model before the Rust core
    // preserved it, so a canonical build silently dropped it.)
    #[test]
    fn import_path_survives_canonical_round_trip() {
        let src = "---\nlmd: 1\nid: 0192f3a1-7c2e-7b3d-9f10-aa01path00002\nversion: 1\ntitle: T\nimports:\n  design:\n    id: 0192f3a1-7c2e-7b3d-9f10-aa01design001\n    path: design.lmd\n    pin: '@7'\n---\n\n## H <!--lmd:a h-->\n\nSee <!--lmd:ref design:uc-join-->it<!--/lmd-->.\n";

        let doc = crate::parse(src).expect("parse");
        assert_eq!(
            doc.frontmatter.imports["design"].path.as_deref(),
            Some("design.lmd"),
            "parse dropped imports.path"
        );

        let out = crate::format_str(src).expect("format");
        assert!(
            out.contains("path: design.lmd"),
            "canonical output dropped imports.path:\n{out}"
        );

        let doc2 = crate::parse(&out).expect("re-parse");
        assert_eq!(
            doc2.frontmatter.imports["design"].path.as_deref(),
            Some("design.lmd"),
            "round-trip dropped imports.path"
        );
    }
}

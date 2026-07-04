//! # lmd-core
//!
//! The reference implementation of the **Linked Markdown** (`.lmd`) format.
//!
//! `.lmd` is Markdown that carries a typed link graph, stable per-block identity,
//! cross-document namespace imports, and versioning — all in YAML front matter
//! and `<!--lmd:… -->` escape comments that vanish on render. See `spec/SPEC.md`.
//!
//! ## Pipeline
//!
//! ```text
//! text ──parse──▶ Doc ──build──▶ Doc{manifest} ──serialize──▶ canonical text
//!                   └────────────────check──────────────────▶ Vec<Diagnostic>
//! ```
//!
//! ```
//! let src = "---\nlmd: 1\nid: doc-1\nversion: 1\ntitle: Hi\n---\n\n## A <!--lmd:a a-->\n";
//! let mut doc = lmd_core::parse(src).unwrap();
//! doc.manifest = Some(lmd_core::build(&doc));
//! assert!(lmd_core::check(&doc).iter().all(|d| d.severity != lmd_core::Severity::Error));
//! let canonical = lmd_core::serialize(&doc).unwrap();
//! assert!(canonical.contains("lmd:manifest"));
//! ```

pub mod address;
pub mod build;
pub mod check;
pub mod error;
pub mod hash;
pub mod model;
pub mod parse;
pub mod scan;
pub mod serialize;

pub use build::{build, build_with};
pub use check::check;
pub use error::{Diagnostic, LmdError, Result, Severity};
pub use model::{
    Doc, Edge, Embed, Frontmatter, Import, ImportLock, Manifest, Node, NodeKind, Origin, Resolved,
};
pub use parse::parse;
pub use serialize::serialize;

/// Spec version implemented by this crate.
pub const SPEC_VERSION: u32 = 1;

/// Parse, (re)build the manifest, and serialize to canonical text in one call.
pub fn format_str(input: &str) -> Result<String> {
    let mut doc = parse(input)?;
    doc.manifest = Some(build(&doc));
    serialize(&doc)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "---\nlmd: 1\nid: 0192f3a1-doc\nversion: 3\ntitle: Sample\nimports:\n  design:\n    id: 0192f3a1-design\n    pin: '@7'\n---\n\n## 회원 인증 <!--lmd:a cap-auth-->\n\n<!--lmd:ref impacts=design:uc-join-->본문<!--/lmd--> 텍스트, <!--lmd:ref policy=design:perf@2-->정책<!--/lmd-->.\n";

    fn deterministic_build(doc: &Doc) -> Manifest {
        let mut n = 0;
        build_with(doc, &mut || {
            n += 1;
            format!("uuid-{n}")
        })
    }

    #[test]
    fn parse_roundtrip_is_stable() {
        let doc = parse(SAMPLE).unwrap();
        let mut doc = doc;
        doc.manifest = Some(deterministic_build(&doc));
        let once = serialize(&doc).unwrap();
        let twice = serialize(&parse(&once).unwrap()).unwrap();
        assert_eq!(once, twice, "serialize must be idempotent");
    }

    #[test]
    fn build_registers_nodes_and_edges() {
        let doc = parse(SAMPLE).unwrap();
        let m = deterministic_build(&doc);
        assert_eq!(m.nodes.len(), 1);
        assert!(m.nodes.contains_key("cap-auth"));
        assert_eq!(m.schema, 1);
        // impacts (design:uc-join) + policy ref (design:perf@2)
        assert_eq!(m.edges.len(), 2);
        assert!(m.imports.contains_key("design"));
        assert_eq!(m.imports["design"].version, 7);
    }

    #[test]
    fn build_preserves_existing_uuid() {
        let doc = parse(SAMPLE).unwrap();
        let mut doc = doc;
        doc.manifest = Some(deterministic_build(&doc));
        let first = doc.manifest.as_ref().unwrap().nodes["cap-auth"]
            .uuid
            .clone();
        // Rebuild: uuid must be preserved, not regenerated.
        let rebuilt = build_with(&doc, &mut || "SHOULD-NOT-BE-USED".to_string());
        assert_eq!(rebuilt.nodes["cap-auth"].uuid, first);
    }

    #[test]
    fn check_flags_dangling_and_unknown() {
        let src = "---\nlmd: 1\nid: d\nversion: 1\ntitle: T\n---\n\n## A <!--lmd:a a-->\n\n<!--lmd:ref :nope-->x<!--/lmd--> and <!--lmd:ref ghost:thing-->y<!--/lmd-->\n";
        let doc = parse(src).unwrap();
        let diags = check(&doc);
        assert!(diags.iter().any(|d| d.code == "dangling-local-ref"));
        assert!(diags.iter().any(|d| d.code == "unknown-namespace"));
    }

    #[test]
    fn check_clean_doc_has_no_errors() {
        let mut doc = parse(SAMPLE).unwrap();
        doc.manifest = Some(deterministic_build(&doc));
        assert!(check(&doc).iter().all(|d| d.severity != Severity::Error));
    }
}

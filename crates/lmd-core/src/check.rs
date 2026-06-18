//! `check`: integrity gates (`spec/SPEC.md` §9).
//!
//! Returns a flat list of [`Diagnostic`]s. A non-empty list with any
//! [`Severity::Error`] means the document is invalid; warnings are advisory
//! (e.g. a stale manifest that `build` would regenerate).

use crate::address::{parse_address, Address};
use crate::error::Diagnostic;
use crate::hash::sha256_prefixed;
use crate::model::Doc;
use crate::scan::scan;
use std::collections::HashSet;

pub fn check(doc: &Doc) -> Vec<Diagnostic> {
    let mut diags = Vec::new();
    let scanned = scan(&doc.body);

    // Slug uniqueness.
    let mut seen: HashSet<&str> = HashSet::new();
    for a in &scanned.anchors {
        if !seen.insert(a.slug.as_str()) {
            diags.push(
                Diagnostic::error(
                    "duplicate-slug",
                    format!("slug `{}` is defined more than once", a.slug),
                )
                .at(a.line),
            );
        }
    }
    let slugs: HashSet<&str> = scanned.anchors.iter().map(|a| a.slug.as_str()).collect();

    // Edge integrity.
    for e in &scanned.edges {
        if e.from.is_none() {
            diags.push(
                Diagnostic::error(
                    "edge-without-anchor",
                    format!("link to `{}` is not attached to any anchor", e.to),
                )
                .at(e.line),
            );
        }
        match parse_address(&e.to) {
            Address::Local { slug, .. } => {
                if !slugs.contains(slug.as_str()) {
                    diags.push(
                        Diagnostic::error(
                            "dangling-local-ref",
                            format!("local reference `:{slug}` has no matching anchor"),
                        )
                        .at(e.line),
                    );
                }
            }
            Address::Cross { alias, .. } => {
                if !doc.frontmatter.imports.contains_key(&alias) {
                    diags.push(
                        Diagnostic::error(
                            "unknown-namespace",
                            format!("namespace `{alias}:` is not declared in front-matter imports"),
                        )
                        .at(e.line),
                    );
                }
            }
            Address::Kg { .. } | Address::External(_) => {}
        }
    }

    // Manifest staleness.
    if let Some(m) = &doc.manifest {
        let live = sha256_prefixed(doc.body.trim());
        if live != m.body_hash {
            diags.push(Diagnostic::warning(
                "stale-manifest",
                "body has changed since the manifest was last built; run `lmd build`",
            ));
        }
    }

    diags
}

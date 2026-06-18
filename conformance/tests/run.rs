//! The Rust conformance runner. Walks the shared fixtures and asserts the
//! portable properties every implementation must hold.

use lmd_conformance::{list, read};

/// `format` must reach a fixed point: formatting an already-formatted document
/// produces identical bytes. This is the core stability guarantee that keeps
/// `.lmd` diffs clean.
#[test]
fn canonical_is_idempotent() {
    let files = list("canonical", "lmd");
    assert!(!files.is_empty(), "no canonical fixtures found");
    for path in files {
        let src = read(&path);
        let once = lmd_core::format_str(&src)
            .unwrap_or_else(|e| panic!("{}: format failed: {e}", path.display()));
        let twice = lmd_core::format_str(&once)
            .unwrap_or_else(|e| panic!("{}: reformat failed: {e}", path.display()));
        assert_eq!(once, twice, "{}: format is not idempotent", path.display());

        // And the formatted document must re-parse.
        lmd_core::parse(&once).unwrap_or_else(|e| {
            panic!(
                "{}: formatted output does not re-parse: {e}",
                path.display()
            )
        });
    }
}

/// Each `*.lmd` under `diagnostics/` must yield exactly the diagnostic codes
/// listed in its sibling `*.codes` file (order-independent, de-duplicated).
#[test]
fn diagnostics_match_expected() {
    let files = list("diagnostics", "lmd");
    assert!(!files.is_empty(), "no diagnostics fixtures found");
    for path in files {
        let src = read(&path);
        let doc = lmd_core::parse(&src)
            .unwrap_or_else(|e| panic!("{}: parse failed: {e}", path.display()));
        let mut got: Vec<String> = lmd_core::check(&doc).into_iter().map(|d| d.code).collect();
        got.sort();
        got.dedup();

        let codes_path = path.with_extension("codes");
        let mut want: Vec<String> = read(&codes_path)
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty())
            .map(str::to_string)
            .collect();
        want.sort();
        want.dedup();

        assert_eq!(got, want, "{}: diagnostic codes mismatch", path.display());
    }
}

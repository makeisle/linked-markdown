//! Conformance helpers.
//!
//! The fixtures in `fixtures/` are the portable contract every Linked Markdown
//! implementation must satisfy. The Rust runner lives in `tests/run.rs`; a future
//! TypeScript runner will load the same files and assert the same properties.
//!
//! ## Fixture kinds
//!
//! - `fixtures/canonical/*.lmd` — formatting fixed points. `format(src)` must be
//!   idempotent: formatting an already-formatted document changes nothing.
//! - `fixtures/diagnostics/*.lmd` paired with `*.codes` — each `.codes` file lists
//!   the diagnostic codes (one per line) that `check` must report for its `.lmd`.

use std::fs;
use std::path::{Path, PathBuf};

pub fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures")
}

/// List files with the given extension in a fixtures subdirectory, sorted.
pub fn list(subdir: &str, ext: &str) -> Vec<PathBuf> {
    let dir = fixtures_dir().join(subdir);
    let mut out: Vec<PathBuf> = fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("reading {}: {e}", dir.display()))
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map(|x| x == ext).unwrap_or(false))
        .collect();
    out.sort();
    out
}

pub fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_else(|e| panic!("reading {}: {e}", path.display()))
}

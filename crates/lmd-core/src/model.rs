//! The in-memory model of a `.lmd` document.
//!
//! Field declaration order in these structs is significant: `serde_json` and
//! `serde_yaml` serialize struct fields in declaration order, and that order is
//! part of the canonical form (see `spec/SPEC.md` §8). Maps use [`BTreeMap`] so
//! their keys come out alphabetically sorted, which is also canonical.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// A whole `.lmd` document: front matter, the verbatim Markdown body, and the
/// machine-managed manifest (absent until `build` has run).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Doc {
    pub frontmatter: Frontmatter,
    /// The Markdown body, verbatim, between the front matter and the manifest.
    /// Leading/trailing blank lines are trimmed; interior content is untouched.
    pub body: String,
    pub manifest: Option<Manifest>,
}

/// YAML front matter — the human-meaningful identity zone.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Frontmatter {
    /// Schema version. v1 == `1`.
    pub lmd: u32,
    /// Document UUID (global, immutable). UUIDv7 recommended.
    pub id: String,
    /// Document version (integer, bumped on content change).
    pub version: u32,
    pub title: String,
    /// Namespace alias -> imported document pin. Alphabetical by alias (canonical).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub imports: BTreeMap<String, Import>,
}

/// One entry of the `imports` table — a namespace alias resolving to another doc.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Import {
    /// Target document UUID — the durable identity.
    pub id: String,
    /// A hint to where the document lives (workspace-relative or network path).
    /// Drift-prone: `id` is authoritative, but `path` is preserved verbatim so a
    /// tool can re-locate a moved file by scanning for `id` and update the hint.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Resolved pinned version, e.g. `"@7"`. The lockfile's concrete pin.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pin: Option<String>,
    /// Allowed range (semver-like). `build` resolves a `pin` within it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub range: Option<String>,
}

/// The manifest — machine-managed link graph and integrity record.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Manifest {
    pub schema: u32,
    /// SHA-256 of the canonical body (`sha256:...`). Detects body/manifest drift.
    pub body_hash: String,
    /// slug -> node. Alphabetical by slug (canonical).
    #[serde(default)]
    pub nodes: BTreeMap<String, Node>,
    /// Outbound edges, sorted by `(from, rel, to)` (canonical).
    #[serde(default)]
    pub edges: Vec<Edge>,
    /// Resolved import lockfile: alias -> pinned identity + hash.
    #[serde(default)]
    pub imports: BTreeMap<String, ImportLock>,
}

/// A linkable block, registered by an `<!--lmd:a slug-->` anchor.
///
/// `uuid` is declared first so it sorts to the top of the serialized object,
/// matching the canonical form rule for node objects.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Node {
    /// Global identity. Also the join key into any external vector store.
    pub uuid: String,
    pub kind: NodeKind,
    /// Node-level revision (mirrors `rev=` in the body anchor).
    pub rev: u32,
    /// SHA-256 of the block's visible text (`sha256:...`).
    pub hash: String,
    /// Optional provenance for reverse-projection into a source-of-truth system.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<Origin>,
    /// Optional embedding pointer (model/time/hash only — never the float vector).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub embed: Option<Embed>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NodeKind {
    Heading,
    Para,
    ListItem,
    TableRow,
    Code,
    Quote,
    Image,
    Hr,
}

/// Provenance tuple: which source field a node was projected from.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Origin {
    pub layer: String,
    pub node: String,
    pub field: String,
}

/// Embedding staleness pointer. Contains no vector data by design.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Embed {
    pub model: String,
    pub at: String,
    pub hash: String,
}

/// A typed outbound link from one node to an address.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Edge {
    /// Source slug.
    pub from: String,
    /// Relationship role (see `spec/SPEC.md` §6).
    pub rel: String,
    /// The address string exactly as written in the body.
    pub to: String,
    /// Resolved UUID for a same-document (local) target.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
    /// Resolution result for a cross-document target.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved: Option<Resolved>,
}

/// Cross-document edge resolution, captured at link time.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Resolved {
    pub doc: String,
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
    /// Target content hash at link time. Differing from the live hash == drift.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
}

/// A resolved import entry in the manifest lockfile.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportLock {
    pub id: String,
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
}

impl NodeKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            NodeKind::Heading => "heading",
            NodeKind::Para => "para",
            NodeKind::ListItem => "list-item",
            NodeKind::TableRow => "table-row",
            NodeKind::Code => "code",
            NodeKind::Quote => "quote",
            NodeKind::Image => "image",
            NodeKind::Hr => "hr",
        }
    }
}

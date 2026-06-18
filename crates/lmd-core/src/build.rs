//! `build`: regenerate the manifest from the body + front matter.
//!
//! Build is idempotent with respect to identity: a slug that already had a UUID
//! in the previous manifest keeps it; only genuinely new slugs get a fresh UUID.
//! Cross-document edges are resolved as far as the import lockfile allows;
//! fetching a target document's live UUID/hash is the job of a workspace
//! resolver (future work) and is left `None` here.

use crate::address::{parse_address, parse_pin, Address};
use crate::hash::sha256_prefixed;
use crate::model::{Doc, Edge, ImportLock, Manifest, Node, Resolved};
use crate::scan::scan;
use std::collections::BTreeMap;

/// Build with the default UUIDv7 generator.
pub fn build(doc: &Doc) -> Manifest {
    build_with(doc, &mut || uuid::Uuid::now_v7().to_string())
}

/// Build with a caller-supplied UUID generator (deterministic in tests).
pub fn build_with(doc: &Doc, new_uuid: &mut dyn FnMut() -> String) -> Manifest {
    let scanned = scan(&doc.body);

    // Preserve existing slug -> uuid bindings.
    let prev_uuid: BTreeMap<String, String> = doc
        .manifest
        .as_ref()
        .map(|m| {
            m.nodes
                .iter()
                .map(|(s, n)| (s.clone(), n.uuid.clone()))
                .collect()
        })
        .unwrap_or_default();
    let prev_origin: BTreeMap<String, _> = doc
        .manifest
        .as_ref()
        .map(|m| {
            m.nodes
                .iter()
                .filter_map(|(s, n)| n.origin.clone().map(|o| (s.clone(), o)))
                .collect()
        })
        .unwrap_or_default();
    let prev_embed: BTreeMap<String, _> = doc
        .manifest
        .as_ref()
        .map(|m| {
            m.nodes
                .iter()
                .filter_map(|(s, n)| n.embed.clone().map(|e| (s.clone(), e)))
                .collect()
        })
        .unwrap_or_default();

    let mut nodes: BTreeMap<String, Node> = BTreeMap::new();
    for a in &scanned.anchors {
        // First occurrence of a slug wins; duplicates are a `check` concern.
        if nodes.contains_key(&a.slug) {
            continue;
        }
        let uuid = match prev_uuid.get(&a.slug) {
            Some(existing) => existing.clone(),
            None => new_uuid(),
        };
        nodes.insert(
            a.slug.clone(),
            Node {
                uuid,
                kind: a.kind,
                rev: a.rev,
                hash: sha256_prefixed(&a.text),
                origin: prev_origin.get(&a.slug).cloned(),
                embed: prev_embed.get(&a.slug).cloned(),
            },
        );
    }

    // Resolved import lockfile (only for imports that carry a concrete pin).
    let mut imports: BTreeMap<String, ImportLock> = BTreeMap::new();
    for (alias, imp) in &doc.frontmatter.imports {
        if let Some(version) = imp.pin.as_deref().and_then(parse_pin) {
            imports.insert(
                alias.clone(),
                ImportLock {
                    id: imp.id.clone(),
                    version,
                    hash: None,
                },
            );
        }
    }

    let mut edges: Vec<Edge> = Vec::new();
    for e in &scanned.edges {
        let Some(from) = e.from.clone() else { continue };
        match parse_address(&e.to) {
            Address::Local { slug, .. } => {
                let uuid = nodes.get(&slug).map(|n| n.uuid.clone());
                edges.push(Edge {
                    from,
                    rel: e.rel.clone(),
                    to: e.to.clone(),
                    uuid,
                    resolved: None,
                });
            }
            Address::Cross { alias, version, .. } => {
                let resolved = imports.get(&alias).map(|lock| {
                    let v = version
                        .as_deref()
                        .and_then(parse_pin)
                        .unwrap_or(lock.version);
                    Resolved {
                        doc: lock.id.clone(),
                        version: v,
                        uuid: None,
                        hash: None,
                    }
                });
                edges.push(Edge {
                    from,
                    rel: e.rel.clone(),
                    to: e.to.clone(),
                    uuid: None,
                    resolved,
                });
            }
            Address::Kg { .. } | Address::External(_) => {
                edges.push(Edge {
                    from,
                    rel: e.rel.clone(),
                    to: e.to.clone(),
                    uuid: None,
                    resolved: None,
                });
            }
        }
    }
    edges.sort_by(|a, b| {
        (a.from.as_str(), a.rel.as_str(), a.to.as_str()).cmp(&(
            b.from.as_str(),
            b.rel.as_str(),
            b.to.as_str(),
        ))
    });
    // Collapse identical edges: the same (from, rel, to) written twice — e.g. a
    // visible link plus an `lmd:rel` for the same target — is one edge.
    edges.dedup_by(|a, b| a.from == b.from && a.rel == b.rel && a.to == b.to);

    Manifest {
        schema: 1,
        body_hash: sha256_prefixed(doc.body.trim()),
        nodes,
        edges,
        imports,
    }
}

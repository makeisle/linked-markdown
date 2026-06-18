//! Parse a `.lmd` source string into a [`Doc`].
//!
//! The three zones are split structurally — YAML front matter, verbatim body,
//! and the trailing `<!--lmd:manifest … -->` JSON comment — and each is decoded
//! independently. CRLF input is normalized to LF (the canonical newline).

use crate::error::{LmdError, Result};
use crate::model::{Doc, Frontmatter, Manifest};

const MANIFEST_OPEN: &str = "<!--lmd:manifest";

pub fn parse(input: &str) -> Result<Doc> {
    let text = input.replace("\r\n", "\n");

    let rest = text
        .strip_prefix("---\n")
        .ok_or(LmdError::MissingFrontmatter)?;

    let close = rest
        .find("\n---\n")
        .ok_or(LmdError::UnterminatedFrontmatter)?;
    let yaml = &rest[..close];
    let after = &rest[close + 5..];

    let frontmatter: Frontmatter =
        serde_yaml::from_str(yaml).map_err(|e| LmdError::Frontmatter(e.to_string()))?;

    let (body, manifest) = match after.find(MANIFEST_OPEN) {
        Some(start) => {
            let body = &after[..start];
            let mrest = &after[start + MANIFEST_OPEN.len()..];
            let end = mrest.find("-->").ok_or(LmdError::UnterminatedManifest)?;
            let json = mrest[..end].trim();
            let manifest: Manifest =
                serde_json::from_str(json).map_err(|e| LmdError::Manifest(e.to_string()))?;
            (body, Some(manifest))
        }
        None => (after, None),
    };

    Ok(Doc {
        frontmatter,
        body: body.trim().to_string(),
        manifest,
    })
}

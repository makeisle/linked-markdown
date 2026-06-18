//! Error and diagnostic types for lmd-core.

use thiserror::Error;

/// Hard failures that prevent a document from being parsed or serialized at all.
#[derive(Debug, Error)]
pub enum LmdError {
    #[error("missing YAML front matter: a .lmd file must start with a `---` line")]
    MissingFrontmatter,

    #[error("unterminated YAML front matter: no closing `---` line found")]
    UnterminatedFrontmatter,

    #[error("invalid YAML front matter: {0}")]
    Frontmatter(String),

    #[error("unterminated manifest: `<!--lmd:manifest` was opened but never closed with `-->`")]
    UnterminatedManifest,

    #[error("invalid manifest JSON: {0}")]
    Manifest(String),
}

pub type Result<T> = std::result::Result<T, LmdError>;

/// Severity of a [`Diagnostic`] produced by [`crate::check`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

/// A single problem found by `check`. Carries a stable machine `code` so tooling
/// (editor, CI) can react without string-matching the message.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Diagnostic {
    pub severity: Severity,
    /// Stable identifier, e.g. `duplicate-slug`, `dangling-local-ref`.
    pub code: String,
    pub message: String,
    /// Optional 1-based line number in the source where the problem occurs.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<usize>,
}

impl Diagnostic {
    pub fn error(code: &str, message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Error,
            code: code.into(),
            message: message.into(),
            line: None,
        }
    }
    pub fn warning(code: &str, message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Warning,
            code: code.into(),
            message: message.into(),
            line: None,
        }
    }
    pub fn at(mut self, line: usize) -> Self {
        self.line = Some(line);
        self
    }
}

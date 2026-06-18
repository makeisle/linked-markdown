//! WebAssembly bindings for `lmd-core`.
//!
//! The boundary is intentionally string-in / string-out (text or JSON) so the
//! TypeScript wrapper (`@lmd/core`) can stay a thin, dependency-free shim. Build
//! with `wasm-pack build --target web` to produce the npm package.

use lmd_core::Doc;
use wasm_bindgen::prelude::*;

fn js_err<E: std::fmt::Display>(e: E) -> JsError {
    JsError::new(&e.to_string())
}

/// Parse `.lmd` source into a `Doc` JSON object.
#[wasm_bindgen]
pub fn parse(src: &str) -> Result<String, JsError> {
    let doc = lmd_core::parse(src).map_err(js_err)?;
    serde_json::to_string(&doc).map_err(js_err)
}

/// Serialize a `Doc` JSON object back into canonical `.lmd` text.
#[wasm_bindgen]
pub fn serialize(doc_json: &str) -> Result<String, JsError> {
    let doc: Doc = serde_json::from_str(doc_json).map_err(js_err)?;
    lmd_core::serialize(&doc).map_err(js_err)
}

/// Parse, rebuild the manifest, and return the full `Doc` JSON object.
#[wasm_bindgen]
pub fn build(src: &str) -> Result<String, JsError> {
    let mut doc = lmd_core::parse(src).map_err(js_err)?;
    doc.manifest = Some(lmd_core::build(&doc));
    serde_json::to_string(&doc).map_err(js_err)
}

/// Run integrity checks; return a JSON array of diagnostics.
#[wasm_bindgen]
pub fn check(src: &str) -> Result<String, JsError> {
    let doc = lmd_core::parse(src).map_err(js_err)?;
    serde_json::to_string(&lmd_core::check(&doc)).map_err(js_err)
}

/// Parse, rebuild the manifest, and return canonical `.lmd` text.
#[wasm_bindgen]
pub fn format(src: &str) -> Result<String, JsError> {
    lmd_core::format_str(src).map_err(js_err)
}

/// The spec version implemented by the underlying core.
#[wasm_bindgen]
pub fn spec_version() -> u32 {
    lmd_core::SPEC_VERSION
}

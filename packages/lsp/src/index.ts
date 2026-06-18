/**
 * `@lmd/lsp` — the Linked Markdown language server.
 *
 * Run it over stdio with the `lmd-lsp` binary, or embed {@link createServer} on
 * your own connection. {@link scan} is exported for reuse.
 */

export { createServer } from "./server.js";
export { scan, inRange, type ScanResult, type AnchorHit, type EdgeHit } from "./scan.js";

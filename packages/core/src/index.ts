/**
 * `@lmd/core` — TypeScript bindings for the Linked Markdown reference
 * implementation (`lmd-core`), backed by WebAssembly.
 *
 * The heavy lifting (parsing, the canonical serializer, build & check) all lives
 * in the Rust core and is compiled to wasm; this package is a thin, typed shim.
 * Call {@link init} once before using the synchronous helpers, or use the async
 * helpers which initialize on first use.
 */

export * from "./address.js";

// The wasm bundle is produced by `wasm-pack build crates/lmd-wasm` into
// `../pkg` (see the repo-root `wasm` script). It is generated, not checked in,
// so it is loaded through a runtime-only dynamic import — the specifier is a
// variable, which keeps the TypeScript build from trying to resolve it.
interface WasmApi {
  default: (input?: unknown) => Promise<unknown>;
  parse(src: string): string;
  serialize(docJson: string): string;
  build(src: string): string;
  check(src: string): string;
  format(src: string): string;
  spec_version(): number;
}

const WASM_MODULE = "../pkg/lmd_wasm.js";

// ---- Model types (mirror of lmd-core's serde model) ----

export type NodeKind =
  | "heading" | "para" | "list-item" | "table-row"
  | "code" | "quote" | "image" | "hr";

export interface Import { id: string; pin?: string; range?: string }
export interface Frontmatter {
  lmd: number;
  id: string;
  version: number;
  title: string;
  imports?: Record<string, Import>;
}
export interface Origin { layer: string; node: string; field: string }
export interface Embed { model: string; at: string; hash: string }
export interface Node {
  uuid: string;
  kind: NodeKind;
  rev: number;
  hash: string;
  origin?: Origin;
  embed?: Embed;
}
export interface Resolved { doc: string; version: number; uuid?: string; hash?: string }
export interface Edge { from: string; rel: string; to: string; uuid?: string; resolved?: Resolved }
export interface ImportLock { id: string; version: number; hash?: string }
export interface Manifest {
  schema: number;
  body_hash: string;
  nodes: Record<string, Node>;
  edges: Edge[];
  imports: Record<string, ImportLock>;
}
export interface Doc {
  frontmatter: Frontmatter;
  body: string;
  manifest?: Manifest;
}

export type Severity = "error" | "warning";
export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  line?: number;
}

// ---- Initialization ----

let wasm: WasmApi | undefined;
let ready: Promise<WasmApi> | undefined;

/** Initialize the wasm module. Idempotent; safe to await repeatedly. */
export function init(input?: unknown): Promise<WasmApi> {
  if (!ready) {
    ready = (import(WASM_MODULE) as Promise<WasmApi>).then(async (m) => {
      // wasm-bindgen's `web` init takes a single options object; passing the
      // module source (bytes/URL/Module) under `module_or_path`. In the browser,
      // calling with no argument lets it fetch the sibling `.wasm`.
      await m.default(input === undefined ? undefined : { module_or_path: input });
      wasm = m;
      return m;
    });
  }
  return ready;
}

async function ensure(): Promise<WasmApi> {
  return wasm ?? (await init());
}

// ---- API ----

/** Parse `.lmd` source into a {@link Doc}. */
export async function parse(src: string): Promise<Doc> {
  const api = await ensure();
  return JSON.parse(api.parse(src)) as Doc;
}

/** Serialize a {@link Doc} back to canonical `.lmd` text. */
export async function serialize(doc: Doc): Promise<string> {
  const api = await ensure();
  return api.serialize(JSON.stringify(doc));
}

/** Parse, (re)build the manifest, and return the full {@link Doc}. */
export async function build(src: string): Promise<Doc> {
  const api = await ensure();
  return JSON.parse(api.build(src)) as Doc;
}

/** Run integrity checks and return the diagnostics. */
export async function check(src: string): Promise<Diagnostic[]> {
  const api = await ensure();
  return JSON.parse(api.check(src)) as Diagnostic[];
}

/** Parse, rebuild the manifest, and return canonical `.lmd` text. */
export async function format(src: string): Promise<string> {
  const api = await ensure();
  return api.format(src);
}

/** The spec version implemented by the underlying core. */
export async function specVersion(): Promise<number> {
  const api = await ensure();
  return api.spec_version();
}

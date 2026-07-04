/**
 * A mock in-memory workspace standing in for a real filesystem.
 *
 * The editor needs to *resolve* the documents an lmd file imports: given an
 * `{ id (uuid), path }` pair from the front-matter import table, find the actual
 * document. Paths drift as files move; UUIDs don't. So the contract here mirrors
 * what a real backend (or the File System Access API) would expose:
 *
 *   - `resolveByPath(path)`  → the doc currently at that path, or null;
 *   - `findByUuid(id)`       → the doc with that uuid wherever it now lives;
 *   - `searchNearby(id, at)` → if a path is stale, the doc's *current* path
 *                              (move detection), or null if it's truly gone;
 *   - `addDoc(path)`         → register a picked/typed document.
 *
 * Everything is swappable: replace this module with one backed by a Node server
 * or `showDirectoryPicker()` and the UI does not change.
 */

export interface WsAnchor {
  slug: string;
  title: string;
}

export interface WsDoc {
  uuid: string;
  title: string;
  /** An lmd body (markdown + anchor comments), enough to render in the modal. */
  body: string;
  anchors: WsAnchor[];
}

/** How an import resolved against the workspace. */
export type Resolution =
  | { status: "found"; doc: WsDoc; path: string }
  | { status: "moved"; doc: WsDoc; from: string; to: string }
  | { status: "missing" };

function anchorsOf(body: string): WsAnchor[] {
  const re = /^(#{1,6})\s*(.*?)\s*<!--lmd:a\s+([a-z][a-z0-9-]*)[^>]*-->/gm;
  const out: WsAnchor[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push({ slug: m[3], title: m[2] || m[3] });
  return out;
}

function doc(uuid: string, title: string, body: string): WsDoc {
  return { uuid, title, body: body.trim(), anchors: anchorsOf(body) };
}

// ── Seed documents ────────────────────────────────────────────────────────
// Two imported docs plus one that is unreachable, to exercise every state.

const DESIGN = doc(
  "0192f3a1-d0d0-7000-9000-00000design01",
  "Compiler architecture",
  `
# Compiler architecture <!--lmd:a arch-->

The reference pipeline is a classic front-end / back-end split with a shared IR.

## Pass manager <!--lmd:a passes-->

Every transform is a *pass* over the IR; passes are ordered by a schedule and may
run more than once. The optimizer is just a pass pipeline.

## Diagnostics <!--lmd:a diagnostics-->

Errors carry a source span so the front end can point at the exact token. The
same span survives lowering, so back-end errors still blame the right line.
`,
);

const POLICY = doc(
  "0192f3a1-d0d0-7000-9000-00000policy01",
  "Language stability policy",
  `
# Language stability policy <!--lmd:a policy-->

A release may not remove a construct without a deprecation window of two versions.

## Deprecation <!--lmd:a deprecation-->

A deprecated construct still parses and still lowers; the front end emits a
warning diagnostic and the manifest records the removal version.

## Versioning <!--lmd:a versioning-->

The document version bumps on any normative change. Imports pin a version so a
reference never silently follows a breaking edit.
`,
);

const GLOSSARY = doc(
  "0192f3a1-d0d0-7000-9000-0000glossary1",
  "Glossary",
  `
# Glossary <!--lmd:a glossary-->

## Intermediate representation <!--lmd:a ir-term-->

A machine-independent form of the program that both the front end and the
optimizer agree on.
`,
);

// ── The "filesystem": where documents *actually* live right now ────────────
// `policy/security.lmd` is intentionally absent — POLICY moved to a v2 folder,
// simulating a file that was reorganized after the import was written.

const FS = new Map<string, string>([
  ["design/architecture.lmd", DESIGN.uuid],
  ["policy/v2/security.lmd", POLICY.uuid], // moved from policy/security.lmd
  ["reference/glossary.lmd", GLOSSARY.uuid],
]);

const DOCS = new Map<string, WsDoc>([
  [DESIGN.uuid, DESIGN],
  [POLICY.uuid, POLICY],
  [GLOSSARY.uuid, GLOSSARY],
]);

export const workspace = {
  /** The doc currently stored at `path`, if any. */
  resolveByPath(path: string): WsDoc | null {
    const id = FS.get(path);
    return id ? (DOCS.get(id) ?? null) : null;
  },

  /** The doc with this uuid, wherever it now lives. */
  findByUuid(id: string): WsDoc | null {
    return DOCS.get(id) ?? null;
  },

  /** The path a uuid currently resolves to, or null if it's gone. */
  pathOf(id: string): string | null {
    for (const [p, u] of FS) if (u === id) return p;
    return null;
  },

  /**
   * Resolve an import. If the declared path holds the right doc → `found`. If it
   * doesn't but the uuid lives elsewhere → `moved` (with the new path). If the
   * uuid is nowhere in the workspace → `missing`.
   */
  resolve(id: string, path: string): Resolution {
    if (FS.get(path) === id) {
      const d = DOCS.get(id);
      if (d) return { status: "found", doc: d, path };
    }
    const now = this.pathOf(id);
    const d = DOCS.get(id);
    if (now && d) return { status: "moved", doc: d, from: path, to: now };
    return { status: "missing" };
  },

  /** Register a picked/typed document under `path`; returns it if known. */
  addDoc(path: string): WsDoc | null {
    const d = this.resolveByPath(path);
    return d;
  },

  /** Paths available to "browse" in the mock file picker. */
  browsable(): { path: string; title: string }[] {
    return [...FS].map(([path, id]) => ({ path, title: DOCS.get(id)?.title ?? path }));
  },
};

export type Workspace = typeof workspace;

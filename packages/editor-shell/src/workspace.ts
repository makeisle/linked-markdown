/**
 * The workspace contract the editing screen depends on.
 *
 * The editor needs to *resolve* the documents an lmd file imports: given an
 * `{ id (uuid), path }` pair from the front-matter import table, find the actual
 * document. Paths drift as files move; UUIDs don't. The host application supplies
 * an implementation (an in-memory mock, a Node server, the File System Access API,
 * a desktop IDE's project index, ...) and passes it to `EditorShell`; this package
 * deliberately ships no implementation.
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

export interface Workspace {
  /** The doc currently stored at `path`, if any. */
  resolveByPath(path: string): WsDoc | null;

  /** The doc with this uuid, wherever it now lives. */
  findByUuid(id: string): WsDoc | null;

  /** The path a uuid currently resolves to, or null if it's gone. */
  pathOf(id: string): string | null;

  /**
   * Resolve an import. If the declared path holds the right doc → `found`. If it
   * doesn't but the uuid lives elsewhere → `moved` (with the new path). If the
   * uuid is nowhere in the workspace → `missing`.
   */
  resolve(id: string, path: string): Resolution;

  /** Register a picked/typed document under `path`; returns it if known. */
  addDoc(path: string): WsDoc | null;

  /** Paths available to "browse" in the file picker. */
  browsable(): { path: string; title: string }[];
}

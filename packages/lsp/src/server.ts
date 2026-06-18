/**
 * The Linked Markdown language server.
 *
 * Diagnostics are authoritative — they come from `@lmd/core`'s `check` (the same
 * Rust core, via wasm). Navigation features (completion, definition, references,
 * symbols, hover) are powered by the position-aware {@link scan}. If the wasm
 * bundle is unavailable the server still offers navigation, just without
 * diagnostics.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import * as core from "@lmd/core";
import {
  CompletionItem,
  CompletionItemKind,
  type Connection,
  Diagnostic,
  DiagnosticSeverity,
  DocumentSymbol,
  Hover,
  Location,
  SymbolKind,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { inRange, scan, type Range } from "./scan.js";

let coreReady: Promise<boolean> | undefined;
function ensureCore(): Promise<boolean> {
  if (!coreReady) {
    coreReady = (async () => {
      try {
        const require = createRequire(import.meta.url);
        const wasmPath = require.resolve("@lmd/core/pkg/lmd_wasm_bg.wasm");
        await core.init(readFileSync(wasmPath));
        return true;
      } catch {
        return false; // wasm not built — navigation still works
      }
    })();
  }
  return coreReady;
}

/** Wire all features onto a connection. Exported so it can be unit-driven. */
export function createServer(connection: Connection): void {
  const documents = new TextDocuments(TextDocument);

  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: [":", "#"] },
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      hoverProvider: true,
    },
  }));

  async function validate(doc: TextDocument): Promise<void> {
    if (!(await ensureCore())) return;
    let diagnostics: Diagnostic[] = [];
    try {
      const found = await core.check(doc.getText());
      diagnostics = found.map((d) => {
        const line = (d.line ?? 1) - 1;
        return {
          severity: d.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
          range: {
            start: { line, character: 0 },
            end: { line, character: Number.MAX_SAFE_INTEGER },
          },
          code: d.code,
          source: "lmd",
          message: d.message,
        };
      });
    } catch {
      /* parse failures surface elsewhere; don't crash the server */
    }
    connection.sendDiagnostics({ uri: doc.uri, diagnostics });
  }

  documents.onDidChangeContent((e) => void validate(e.document));

  connection.onCompletion((params): CompletionItem[] => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    const { anchors, imports } = scan(doc.getText());
    const prefix = doc.getText({
      start: { line: params.position.line, character: 0 },
      end: params.position,
    });

    if (/[:#][a-z0-9-]*$/.test(prefix)) {
      return anchors.map((a) => ({ label: a.slug, kind: CompletionItemKind.Reference, detail: "lmd anchor" }));
    }
    return imports.map((alias) => ({
      label: `${alias}:`,
      kind: CompletionItemKind.Module,
      detail: "lmd namespace",
    }));
  });

  connection.onDefinition((params): Location | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const { anchors, edges } = scan(doc.getText());
    const edge = edges.find((e) => inRange(e.range, params.position));
    if (!edge) return null;
    const addr = core.parseAddress(edge.target);
    if (addr.kind !== "local") return null;
    const anchor = anchors.find((a) => a.slug === addr.slug);
    return anchor ? { uri: doc.uri, range: anchor.range } : null;
  });

  connection.onReferences((params): Location[] => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    const { anchors, edges } = scan(doc.getText());
    const slug = slugAt(anchors, edges, params.position);
    if (!slug) return [];
    return edges
      .filter((e) => {
        const a = core.parseAddress(e.target);
        return a.kind === "local" && a.slug === slug;
      })
      .map((e) => ({ uri: doc.uri, range: e.range }));
  });

  connection.onDocumentSymbol((params): DocumentSymbol[] => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    return scan(doc.getText()).anchors.map((a) => ({
      name: a.slug,
      kind: SymbolKind.Key,
      range: a.range,
      selectionRange: a.range,
    }));
  });

  connection.onHover((params): Hover | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const { anchors, edges } = scan(doc.getText());
    const anchor = anchors.find((a) => inRange(a.range, params.position));
    if (anchor) return { contents: { kind: "markdown", value: `**lmd anchor** \`${anchor.slug}\`` } };
    const edge = edges.find((e) => inRange(e.range, params.position));
    if (edge) return { contents: { kind: "markdown", value: `**lmd link** → \`${edge.target}\` (${edge.rel})` } };
    return null;
  });

  documents.listen(connection);
  connection.listen();
}

function slugAt(
  anchors: { slug: string; range: Range }[],
  edges: { target: string; range: Range }[],
  pos: { line: number; character: number },
): string | undefined {
  const a = anchors.find((x) => inRange(x.range, pos));
  if (a) return a.slug;
  const e = edges.find((x) => inRange(x.range, pos));
  if (!e) return undefined;
  const addr = core.parseAddress(e.target);
  return addr.kind === "local" ? addr.slug : undefined;
}

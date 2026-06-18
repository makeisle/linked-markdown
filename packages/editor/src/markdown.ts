/**
 * Markdown ⇆ ProseMirror conversion for Linked Markdown bodies.
 *
 * Built on `prosemirror-markdown`: the parser is the default token mapping plus
 * handlers that turn HTML-comment tokens into the `lmd_comment` /
 * `lmd_block_comment` atoms from {@link lmdSchema}; the serializer is the default
 * one plus node writers that emit those atoms back verbatim. Because the atoms
 * round-trip byte-for-byte, the only normalization is the standard Markdown
 * serializer's (heading style, list spacing), which is idempotent.
 *
 * Scope: operates on the **body** of a `.lmd` document. Front matter and the
 * manifest are handled by `@lmd/core` (`parse` / `build`). A typical edit flow is
 * `core.parse(src).body → parseLmdBody → …edit… → serializeLmdBody → core.build`.
 */

import MarkdownIt from "markdown-it";
import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import type { Node as PMNode } from "prosemirror-model";
import { lmdSchema } from "./schema.js";

const md = MarkdownIt("commonmark", { html: true });

// Reuse the default token mappings, adding HTML-comment handling. Any inline or
// block raw HTML in an lmd body is, by construction, an lmd escape comment.
const tokens = {
  ...(defaultMarkdownParser as unknown as { tokens: Record<string, unknown> }).tokens,
  html_inline: { node: "lmd_comment", getAttrs: (tok: { content: string }) => ({ raw: tok.content }) },
  html_block: { node: "lmd_block_comment", getAttrs: (tok: { content: string }) => ({ raw: tok.content.trim() }) },
};

/** Markdown → ProseMirror parser for lmd bodies. */
export const lmdMarkdownParser = new MarkdownParser(lmdSchema, md, tokens);

/** ProseMirror → Markdown serializer for lmd bodies. */
export const lmdMarkdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    lmd_comment(state: { write(s: string): void }, node: PMNode) {
      state.write(node.attrs.raw as string);
    },
    lmd_block_comment(state: { write(s: string): void; closeBlock(n: PMNode): void }, node: PMNode) {
      state.write(node.attrs.raw as string);
      state.closeBlock(node);
    },
  },
  defaultMarkdownSerializer.marks,
);

/** Parse a `.lmd` body into a ProseMirror document. */
export function parseLmdBody(body: string): PMNode {
  // lmd-core hands over trimmed bodies; markdown-it's block parser needs a
  // trailing newline to reliably close the final block.
  const src = body.endsWith("\n") ? body : `${body}\n`;
  const doc = lmdMarkdownParser.parse(src);
  if (!doc) throw new Error("lmd-editor: failed to parse body");
  return doc;
}

/** Serialize a ProseMirror document back to a `.lmd` body. */
export function serializeLmdBody(doc: PMNode): string {
  return lmdMarkdownSerializer.serialize(doc);
}

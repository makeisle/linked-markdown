/**
 * Bridge between TipTap's document JSON and the `lmd-core` round-trip.
 *
 * The Markdown round-trip (`parseLmdBody` / `serializeLmdBody`) is built on the
 * `prosemirror-markdown` schema, whose node/mark names are snake_case
 * (`bullet_list`, `strong`, …). TipTap's StarterKit uses camelCase
 * (`bulletList`, `bold`, …). This module renames between the two shapes so the
 * TipTap editor can keep using the single, tested Markdown engine — there is no
 * second Markdown parser. The lmd atom nodes (`lmd_comment`,
 * `lmd_block_comment`) share a name on both sides and pass through untouched.
 */

import { lmdSchema } from "./schema.js";
import { parseLmdBody, serializeLmdBody } from "./markdown.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const NODE_TO_TIPTAP: Record<string, string> = {
  code_block: "codeBlock",
  bullet_list: "bulletList",
  ordered_list: "orderedList",
  list_item: "listItem",
  horizontal_rule: "horizontalRule",
  hard_break: "hardBreak",
};
const MARK_TO_TIPTAP: Record<string, string> = { strong: "bold", em: "italic" };

const invert = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const NODE_TO_PM = invert(NODE_TO_TIPTAP);
const MARK_TO_PM = invert(MARK_TO_TIPTAP);

function mapAttrs(type: string, attrs: Json, toTiptap: boolean): Json {
  if (!attrs) return attrs;
  const out = { ...attrs };
  if (type === "ordered_list" || type === "orderedList") {
    if (toTiptap && "order" in out) {
      out.start = out.order;
      delete out.order;
    } else if (!toTiptap && "start" in out) {
      out.order = out.start;
      delete out.start;
    }
  }
  if (type === "code_block" || type === "codeBlock") {
    if (toTiptap && "params" in out) {
      out.language = out.params;
      delete out.params;
    } else if (!toTiptap && "language" in out) {
      out.params = out.language;
      delete out.language;
    }
  }
  return out;
}

function walk(node: Json, toTiptap: boolean): Json {
  const nodeMap = toTiptap ? NODE_TO_TIPTAP : NODE_TO_PM;
  const markMap = toTiptap ? MARK_TO_TIPTAP : MARK_TO_PM;
  const out: Json = { ...node };
  if (node.type) out.type = nodeMap[node.type] ?? node.type;
  if (node.attrs) out.attrs = mapAttrs(node.type, node.attrs, toTiptap);
  if (node.marks) {
    out.marks = node.marks.map((m: Json) => ({ ...m, type: markMap[m.type] ?? m.type }));
  }
  if (node.content) out.content = node.content.map((c: Json) => walk(c, toTiptap));
  return out;
}

/** Parse a `.lmd` body into a TipTap-compatible document JSON. */
export function markdownToTiptap(body: string): Json {
  return walk(parseLmdBody(body).toJSON(), true);
}

/** Serialize a TipTap document JSON back into a `.lmd` body. */
export function tiptapToMarkdown(json: Json): string {
  const node = lmdSchema.nodeFromJSON(walk(json, false));
  return serializeLmdBody(node);
}

/**
 * The ProseMirror schema for editing Linked Markdown. It is the standard
 * `prosemirror-markdown` schema (which TipTap builds on) extended with two atom
 * nodes that preserve lmd escape comments losslessly:
 *
 * - `lmd_comment` — an inline atom holding a raw `<!--lmd:a … -->` /
 *   `<!--lmd:ref … -->` comment.
 * - `lmd_block_comment` — a block atom holding a standalone `<!--lmd:rel … -->`.
 *
 * Keeping the comments as opaque preserved nodes is what makes the round-trip
 * robust: the editor never has to *understand* an anchor or edge to keep it
 * intact. Their meaning is re-derived by `lmd-core` on `build`. A React/TipTap
 * node view can render these atoms as chips ("⚓ slug", "🔗 policy") without
 * changing the model.
 */

import { schema as base } from "prosemirror-markdown";
import { Schema, type NodeSpec } from "prosemirror-model";

const lmdComment: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  attrs: { raw: { default: "" } },
  toDOM: (node) => [
    "span",
    { class: "lmd-comment", "data-lmd-raw": node.attrs.raw as string },
    "",
  ],
  parseDOM: [
    {
      tag: "span.lmd-comment",
      getAttrs: (dom) => ({ raw: (dom as HTMLElement).getAttribute("data-lmd-raw") ?? "" }),
    },
  ],
};

const lmdBlockComment: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  attrs: { raw: { default: "" } },
  toDOM: (node) => ["div", { class: "lmd-block-comment" }, node.attrs.raw as string],
  parseDOM: [{ tag: "div.lmd-block-comment", preserveWhitespace: "full" }],
};

// The base schema's heading content is `(text | image)*` — it does not admit the
// `inline` group, so an anchor comment placed in a heading would be silently
// dropped. Widen it to allow `lmd_comment`.
const headingSpec = base.spec.nodes.get("heading")!;

/** The lmd-aware ProseMirror schema. */
export const lmdSchema: Schema<string, string> = new Schema({
  nodes: base.spec.nodes
    .update("heading", { ...headingSpec, content: "(text | image | lmd_comment)*" })
    .addToEnd("lmd_comment", lmdComment)
    .addToEnd("lmd_block_comment", lmdBlockComment),
  marks: base.spec.marks,
});

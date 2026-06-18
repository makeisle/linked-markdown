/**
 * TipTap node extensions for the two lmd escape-comment atoms. They mirror the
 * `lmd_comment` / `lmd_block_comment` nodes in {@link lmdSchema} (same names, so
 * the {@link ./bridge} round-trip passes them through unchanged) and render as
 * chips via a React node view.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import * as React from "react";
import { CommentChip } from "./chip.js";

const rawAttr = {
  raw: {
    default: "",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-lmd-raw") ?? "",
    renderHTML: (attrs: { raw: string }) => ({ "data-lmd-raw": attrs.raw }),
  },
};

/** Inline atom: `<!--lmd:a slug-->` and `<!--lmd:ref …-->`. */
export const LmdComment = Node.create({
  name: "lmd_comment",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => rawAttr,
  parseHTML: () => [{ tag: "span.lmd-comment" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes({ class: "lmd-comment" }, HTMLAttributes)],
  addNodeView() {
    return ReactNodeViewRenderer((props: ReactNodeViewProps) => (
      <CommentChip raw={String(props.node.attrs.raw ?? "")} />
    ));
  },
});

/** Block atom: a standalone `<!--lmd:rel …-->` line. */
export const LmdBlockComment = Node.create({
  name: "lmd_block_comment",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes: () => rawAttr,
  parseHTML: () => [{ tag: "div.lmd-block-comment" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes({ class: "lmd-block-comment" }, HTMLAttributes)],
  addNodeView() {
    return ReactNodeViewRenderer((props: ReactNodeViewProps) => (
      <CommentChip raw={String(props.node.attrs.raw ?? "")} block />
    ));
  },
});

// Re-export so consumers can render outside an editor if needed.
export { NodeViewWrapper };

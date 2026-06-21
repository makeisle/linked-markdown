/**
 * The little inline chip a lmd escape comment renders as inside the editor. The
 * raw comment text stays the source of truth in the node's `raw` attr; this only
 * affects how it *looks* while editing.
 */

import { NodeViewWrapper } from "@tiptap/react";
import * as React from "react";

/** Turn a raw lmd comment into a short, human label. */
export function describeComment(raw: string): { icon: string; label: string; kind: string } {
  const anchor = raw.match(/<!--lmd:a\s+([a-z][a-z0-9-]*)(?:\s+rev=\d+)?\s*-->/);
  if (anchor) return { icon: "⚓", label: anchor[1], kind: "anchor" };

  const ref = raw.match(/<!--lmd:ref\b([^>]*)-->/);
  if (ref) {
    const rel = ref[1].match(/\brel=([a-z_]+)/);
    return { icon: "🔗", label: rel ? rel[1] : "ref", kind: "ref" };
  }

  const rel = raw.match(/<!--lmd:rel\s+([^>]*)-->/);
  if (rel) {
    const roles = [...rel[1].matchAll(/([a-z_]+)=/g)].map((m) => m[1]);
    return { icon: "↪", label: roles.join(" · ") || "rel", kind: "rel" };
  }

  return { icon: "•", label: raw, kind: "unknown" };
}

export function CommentChip({ raw, block }: { raw: string; block?: boolean }) {
  const { icon, label, kind } = describeComment(raw);
  return (
    <NodeViewWrapper
      as={block ? "div" : "span"}
      className={`lmd-chip lmd-chip--${kind}`}
      title={raw}
      contentEditable={false}
      data-lmd-raw={raw}
    >
      <span className="lmd-chip__icon">{icon}</span>
      <span className="lmd-chip__label">{label}</span>
    </NodeViewWrapper>
  );
}

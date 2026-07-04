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

  if (/<!--\s*\/lmd\s*-->/.test(raw)) return { icon: "⟩", label: "", kind: "close" };

  // Ref opener: <!--lmd:ref [role=]addr,… …-->. Label with the roles, or the
  // number of targets when they are untyped.
  const ref = raw.match(/<!--lmd:ref\s+([^>]*?)\s*-->/);
  if (ref) {
    const roles = [...ref[1].matchAll(/([a-z_]+)=/g)].map((m) => m[1]);
    const targets = (ref[1].match(/[:#][a-z0-9-]+/g) ?? []).length;
    const label = roles.length ? roles.join(" · ") : `${targets} target${targets === 1 ? "" : "s"}`;
    return { icon: "🔗", label, kind: "ref" };
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

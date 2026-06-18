/**
 * DOM mounting for the viewer. Renders a {@link Doc} into a container element
 * and wires lightweight interactivity: hovering a ref highlights its target
 * anchor, and each anchor gets a backlink count. Kept framework-agnostic — a
 * React/Vue wrapper can be layered on top, or this can be used directly.
 */

import type { Doc } from "@lmd/core";
import { renderToHtml, type RenderResult } from "./render.js";

export interface MountHandle {
  result: RenderResult;
  /** Re-render with a new document. */
  update(doc: Doc): void;
  /** Remove rendered content and listeners. */
  destroy(): void;
}

export function mount(el: HTMLElement, doc: Doc): MountHandle {
  let result = renderToHtml(doc);

  function paint() {
    el.innerHTML = result.html;
    el.classList.add("lmd-viewer");

    // Annotate anchors with their inbound backlink count.
    for (const [slug, links] of Object.entries(result.backlinks)) {
      const target = el.querySelector<HTMLElement>(`#lmd-${CSS.escape(slug)}`);
      if (target) {
        target.dataset.lmdBacklinks = String(links.length);
        target.closest<HTMLElement>("*")?.classList.add("lmd-has-backlinks");
      }
    }

    // Hovering a ref highlights the target anchor (for same-document targets).
    el.querySelectorAll<HTMLAnchorElement>("a.lmd-ref").forEach((a) => {
      const target = a.dataset.lmdTarget ?? "";
      const local = target.match(/^[:#]([a-z0-9-]+)/);
      a.addEventListener("mouseenter", () => {
        if (local) el.querySelector(`#lmd-${CSS.escape(local[1])}`)?.classList.add("lmd-highlight");
      });
      a.addEventListener("mouseleave", () => {
        el.querySelectorAll(".lmd-highlight").forEach((n) => n.classList.remove("lmd-highlight"));
      });
    });
  }

  paint();

  return {
    get result() {
      return result;
    },
    update(next: Doc) {
      result = renderToHtml(next);
      paint();
    },
    destroy() {
      el.innerHTML = "";
      el.classList.remove("lmd-viewer");
    },
  };
}

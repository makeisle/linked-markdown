import * as core from "@lmd/core";
import { renderToHtml } from "@lmd/viewer";
import * as React from "react";
import { useMemo } from "react";
import type { WsDoc } from "./workspace.js";

/**
 * Renders an imported document in a modal, scrolled to and highlighting one
 * anchor. Shared by the editor's anchor flyout and the reader's cross-doc cards.
 */
export function ModalViewer({ doc, slug, onClose }: { doc: WsDoc; slug: string; onClose: () => void }) {
  const html = useMemo(() => {
    const fm: core.Frontmatter = { lmd: 1, id: doc.uuid, version: 1, title: doc.title };
    return renderToHtml({ frontmatter: fm, body: doc.body }).html;
  }, [doc]);

  const focus = (root: HTMLElement | null) => {
    if (!root) return;
    const el = root.querySelector(`[data-lmd-anchor="${slug}"]`);
    const block = (el?.closest("h1,h2,h3,h4,h5,h6,p,li") as HTMLElement) ?? (el as HTMLElement | null);
    if (block) {
      block.classList.add("lmd-focus");
      requestAnimationFrame(() => block.scrollIntoView({ block: "center" }));
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal__bar">
          <div className="modal__meta">
            <span className="modal__title">{doc.title}</span>
            <code className="modal__uuid">{doc.uuid}</code>
          </div>
          <button className="modal__x" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal__scroll">
          <article className="doc__body" ref={focus} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <footer className="modal__foot">
          focused on <code>:{slug}</code>
        </footer>
      </div>
    </div>
  );
}

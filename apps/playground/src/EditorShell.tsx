import * as core from "@lmd/core";
import { renderToHtml } from "@lmd/viewer";
import * as React from "react";
import { useMemo, useState } from "react";
import { SectionEditor, type AnchorOption, type CrossAnchor } from "./SectionEditor.js";
import { workspace, type Resolution, type WsAnchor, type WsDoc } from "./workspace.js";

interface Imp {
  alias: string;
  id: string;
  path: string;
}

/** Slugify a title into a fresh, unique import alias. */
function aliasFrom(title: string, taken: Set<string>): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "doc";
  let a = base;
  let n = 2;
  while (taken.has(a)) a = `${base}-${n++}`;
  return a;
}

/** Render an imported doc into the modal, focused on one anchor. */
function ModalViewer({ doc, slug, onClose }: { doc: WsDoc; slug: string; onClose: () => void }) {
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

export function EditorShell({
  initial,
  anchors,
  imports,
  onSave,
  onCancel,
}: {
  initial: string;
  anchors: AnchorOption[];
  imports: Record<string, core.Import>;
  onSave: (md: string) => void;
  onCancel: () => void;
}) {
  // Import paths are editable so "relink" can adopt a detected move.
  const [paths, setPaths] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(imports).map(([a, im]) => [a, im.path ?? ""])),
  );
  const [extra, setExtra] = useState<Imp[]>([]);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<{ doc: WsDoc; slug: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [pathInput, setPathInput] = useState("");

  const imps = useMemo<Imp[]>(() => {
    const base = Object.entries(imports).map(([alias, im]) => ({
      alias,
      id: im.id,
      path: paths[alias] ?? im.path ?? "",
    }));
    return [...base, ...extra];
  }, [imports, paths, extra]);

  const resolved = useMemo<Map<string, Resolution>>(() => {
    const m = new Map<string, Resolution>();
    for (const im of imps) m.set(im.alias, workspace.resolve(im.id, im.path));
    return m;
  }, [imps]);

  // Imported anchors offered to the editor's `ref ` autocomplete.
  const crossAnchors = useMemo<CrossAnchor[]>(() => {
    const out: CrossAnchor[] = [];
    for (const im of imps) {
      if (dropped.has(im.alias)) continue;
      const r = resolved.get(im.alias);
      const doc = r && r.status !== "missing" ? r.doc : null;
      if (!doc) continue;
      for (const a of doc.anchors) out.push({ addr: `${im.alias}:${a.slug}`, label: a.title, alias: im.alias });
    }
    return out;
  }, [imps, resolved, dropped]);

  function relink(alias: string) {
    const r = resolved.get(alias);
    if (r?.status === "moved") setPaths((p) => ({ ...p, [alias]: r.to }));
  }
  function dropLinks(alias: string) {
    setDropped((d) => new Set(d).add(alias));
    if (selected === alias) setSelected(null);
  }
  function keepLinks(alias: string) {
    setDropped((d) => {
      const n = new Set(d);
      n.delete(alias);
      return n;
    });
  }
  function addByPath(path: string) {
    const doc = workspace.resolveByPath(path.trim());
    if (!doc) return;
    if (imps.some((im) => im.id === doc.uuid)) {
      setAdding(false);
      return;
    }
    const taken = new Set(imps.map((im) => im.alias));
    const alias = aliasFrom(doc.title, taken);
    setExtra((e) => [...e, { alias, id: doc.uuid, path }]);
    setAdding(false);
    setPathInput("");
  }

  const openDoc = (im: Imp) => {
    const r = resolved.get(im.alias);
    if (r && r.status !== "missing") setSelected((s) => (s === im.alias ? null : im.alias));
  };
  const flyDoc: WsDoc | null = (() => {
    if (!selected) return null;
    const r = resolved.get(selected);
    return r && r.status !== "missing" ? r.doc : null;
  })();
  const flyAlias = selected;

  return (
    <div className="eshell">
      <aside className="eside">
        <div className="eside__head">
          <span className="eside__title">Linked documents</span>
          <button className="eside__add" title="Add a reference document" onClick={() => setAdding((a) => !a)}>
            +
          </button>
        </div>

        {adding && (
          <div className="eadd">
            <div className="eadd__label">Pick from the workspace</div>
            <ul className="eadd__list">
              {workspace.browsable().map((b) => (
                <li key={b.path}>
                  <button className="eadd__opt" onClick={() => addByPath(b.path)}>
                    <span className="eadd__optTitle">{b.title}</span>
                    <code className="eadd__optPath">{b.path}</code>
                  </button>
                </li>
              ))}
            </ul>
            <div className="eadd__label">…or type a path</div>
            <div className="eadd__row">
              <input
                className="eadd__input"
                placeholder="e.g. reference/glossary.lmd"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addByPath(pathInput)}
              />
              <button className="btn btn--primary" onClick={() => addByPath(pathInput)}>
                Add
              </button>
            </div>
          </div>
        )}

        <ul className="elist">
          {imps.map((im) => {
            const r = resolved.get(im.alias);
            const status = dropped.has(im.alias) ? "dropped" : (r?.status ?? "missing");
            const active = selected === im.alias;
            return (
              <li key={im.alias} className={`elist__item is-${status}${active ? " is-active" : ""}`}>
                <button className="elist__row" onClick={() => openDoc(im)}>
                  <span className={`dot dot--${status}`} aria-hidden />
                  <span className="elist__alias">{im.alias}</span>
                  <code className={`elist__path${status === "moved" || status === "missing" ? " is-bad" : ""}`}>
                    {im.path || "—"}
                  </code>
                </button>
                <code className="elist__uuid">{im.id}</code>

                {status === "moved" && r?.status === "moved" && (
                  <div className="elist__fix">
                    <span className="elist__moved">
                      moved → <code>{r.to}</code>
                    </span>
                    <button className="chipbtn chipbtn--ok" onClick={() => relink(im.alias)}>
                      Relink
                    </button>
                  </div>
                )}
                {status === "missing" && (
                  <div className="elist__fix">
                    <span className="elist__gone">not found by UUID</span>
                    <button className="chipbtn" onClick={() => dropLinks(im.alias)}>
                      Delete links
                    </button>
                    <button className="chipbtn" onClick={() => keepLinks(im.alias)}>
                      Keep
                    </button>
                  </div>
                )}
                {status === "dropped" && (
                  <div className="elist__fix">
                    <span className="elist__gone">links removed</span>
                    <button className="chipbtn" onClick={() => keepLinks(im.alias)}>
                      Undo
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {imps.length === 0 && <li className="elist__empty">No linked documents yet.</li>}
        </ul>
      </aside>

      {flyDoc && flyAlias && (
        <aside className="eflyout">
          <div className="eflyout__head">
            <span className="eflyout__alias">{flyAlias}</span>
            <span className="eflyout__title">{flyDoc.title}</span>
            <button className="eflyout__x" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          <ul className="eflyout__list">
            {flyDoc.anchors.map((a: WsAnchor) => (
              <li key={a.slug}>
                <button className="eflyout__opt" onClick={() => setModal({ doc: flyDoc, slug: a.slug })}>
                  <span className="eflyout__optTitle">{a.title}</span>
                  <code className="eflyout__optSlug">
                    {flyAlias}:{a.slug}
                  </code>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <main className="emain">
        <SectionEditor
          initial={initial}
          anchors={anchors}
          crossAnchors={crossAnchors}
          onSave={onSave}
          onCancel={onCancel}
        />
      </main>

      {modal && <ModalViewer doc={modal.doc} slug={modal.slug} onClose={() => setModal(null)} />}
    </div>
  );
}

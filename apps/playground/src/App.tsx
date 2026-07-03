import * as core from "@lmd/core";
import { renderToHtml } from "@lmd/viewer";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import wasmUrl from "@lmd/core/pkg/lmd_wasm_bg.wasm?url";
import { DEMO } from "./demo.js";
import { SectionEditor } from "./SectionEditor.js";

interface Section {
  slug: string;
  title: string;
  md: string;
}

const ANCHOR = /<!--lmd:a\s+([a-z][a-z0-9-]*)[^>]*-->/;
const ANCHOR_G = /<!--lmd:a\s+([a-z][a-z0-9-]*)[^>]*-->/g;
const FM: core.Frontmatter = { lmd: 1, id: "demo", version: 1, title: "Demo" };

function splitSections(body: string): Section[] {
  const lines = body.split("\n");
  const marks: { slug: string; line: number }[] = [];
  lines.forEach((l, i) => {
    const m = l.match(ANCHOR);
    if (m) marks.push({ slug: m[1], line: i });
  });
  return marks.map((mk, idx) => {
    const end = idx + 1 < marks.length ? marks[idx + 1].line : lines.length;
    const md = lines.slice(mk.line, end).join("\n").trim();
    const title = lines[mk.line].replace(ANCHOR_G, "").replace(/^#+\s*/, "").trim();
    return { slug: mk.slug, title, md };
  });
}

function preview(md: string): string {
  return md
    .split("\n")
    .slice(1)
    .join(" ")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function focusAnchor(root: HTMLElement | null, slug: string, highlight: boolean) {
  if (!root) return;
  if (highlight) root.querySelectorAll(".lmd-focus").forEach((e) => e.classList.remove("lmd-focus"));
  const el = root.querySelector(`[data-lmd-anchor="${slug}"]`);
  if (!el) return;
  const block = (el.closest("h1,h2,h3,h4,h5,h6,p,li") as HTMLElement) ?? (el as HTMLElement);
  if (highlight) block.classList.add("lmd-focus");
  block.scrollIntoView({ behavior: highlight ? "smooth" : "auto", block: "center" });
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(DEMO);
  const [history, setHistory] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  const centerRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    core.init(wasmUrl).then(() => setReady(true)).catch((e) => setError(String(e)));
  }, []);

  const sections = useMemo(() => splitSections(body), [body]);
  const bySlug = useMemo(() => new Map(sections.map((s) => [s.slug, s])), [sections]);
  const docHtml = useMemo(() => renderToHtml({ frontmatter: FM, body }).html, [body]);

  const [outgoing, setOutgoing] = useState<Map<string, { slug: string; rel: string }[]>>(new Map());
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await core.build(`---\nlmd: 1\nid: demo\nversion: 1\ntitle: Demo\n---\n\n${body}\n`);
        if (cancelled) return;
        const map = new Map<string, { slug: string; rel: string }[]>();
        for (const e of doc.manifest?.edges ?? []) {
          const addr = core.parseAddress(e.to);
          if (addr.kind !== "local" || !bySlug.has(addr.slug)) continue;
          const list = map.get(e.from) ?? [];
          if (!list.some((x) => x.slug === addr.slug)) list.push({ slug: addr.slug, rel: e.rel });
          map.set(e.from, list);
        }
        setOutgoing(map);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, body, bySlug]);

  useEffect(() => {
    if (!sections.length) return;
    setHistory((h) => {
      const kept = h.filter((s) => bySlug.has(s));
      return kept.length ? kept : [sections[0].slug];
    });
  }, [sections, bySlug]);

  const currentSlug = history[history.length - 1];
  const prevSlug = history.length > 1 ? history[history.length - 2] : null;

  // Focus (scroll + highlight) the current anchor in the center; scroll the left
  // pane to the previous anchor.
  useEffect(() => {
    if (editing || !currentSlug) return;
    focusAnchor(centerRef.current, currentSlug, true);
  }, [currentSlug, docHtml, editing, outgoing]);
  useEffect(() => {
    if (prevSlug) focusAnchor(prevRef.current, prevSlug, false);
  }, [prevSlug, docHtml, outgoing]);

  const navigate = (slug: string) => bySlug.has(slug) && setHistory((h) => [...h, slug]);
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));

  function onCenterClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a.lmd-ref") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const addr = core.parseAddress(a.dataset.lmdTarget ?? "");
    if (addr.kind === "local") navigate(addr.slug);
  }

  function saveEdit(newBody: string) {
    setBody(newBody);
    setEditing(false);
  }

  if (error) return <div className="fatal">⚠ {error}</div>;
  if (!ready || !currentSlug) return <div className="loading">Loading…</div>;

  const links = outgoing.get(currentSlug) ?? [];

  return (
    <div className="reader">
      <header className="reader__bar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ⬡
          </span>
          <span className="brand__name">Linked Markdown</span>
          <span className="brand__tag">reader</span>
        </div>
        <nav className="crumbs">
          {history.map((slug, i) => (
            <span key={i} className="crumbs__item">
              {i > 0 && <span className="crumbs__sep">›</span>}
              <span className={i === history.length - 1 ? "is-current" : ""}>{bySlug.get(slug)?.title ?? slug}</span>
            </span>
          ))}
        </nav>
      </header>

      <main className="cols">
        <section className="col col--prev">
          <div className="col__label">Previous</div>
          {prevSlug ? (
            <div className="doc doc--ghost" title="Go back" onClick={back}>
              <div className="doc__body" ref={prevRef} dangerouslySetInnerHTML={{ __html: docHtml }} />
              <div className="doc__badge">
                {bySlug.get(prevSlug)!.title} · ← back
              </div>
            </div>
          ) : (
            <div className="col__empty">You are at the start.</div>
          )}
        </section>

        <section className="col col--current">
          <div className="col__label">
            {prevSlug && !editing && (
              <button className="backbtn" onClick={back} title="Back">
                ←
              </button>
            )}
            {editing ? "Editing" : "Focused on"}
            {!editing && <span className="focustag">{bySlug.get(currentSlug)?.title}</span>}
            {!editing && (
              <button className="editbtn" onClick={() => setEditing(true)}>
                ✎ Edit
              </button>
            )}
          </div>
          {editing ? (
            <SectionEditor
              initial={body}
              anchors={sections.map((s) => ({ slug: s.slug, title: s.title }))}
              onSave={saveEdit}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <article className="doc doc--current" onClick={onCenterClick}>
              <div className="doc__body" ref={centerRef} dangerouslySetInnerHTML={{ __html: docHtml }} />
            </article>
          )}
        </section>

        <section className="col col--links">
          <div className="col__label">
            Links from <span className="focustag">{bySlug.get(currentSlug)?.title}</span>
            <span className="count">{links.length}</span>
          </div>
          {links.length === 0 ? (
            <div className="col__empty">This section links nowhere.</div>
          ) : (
            <ul className="cards">
              {links.map(({ slug, rel }) => {
                const sec = bySlug.get(slug)!;
                return (
                  <li key={slug}>
                    <button className="card" onClick={() => navigate(slug)} disabled={editing}>
                      <div className="card__head">
                        <span className="card__title">{sec.title}</span>
                        <span className="card__rel">{rel}</span>
                      </div>
                      <div className="card__preview">{preview(sec.md)}</div>
                      <div className="card__go">focus →</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

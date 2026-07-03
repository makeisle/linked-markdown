import * as core from "@lmd/core";
import { renderToHtml } from "@lmd/viewer";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import wasmUrl from "@lmd/core/pkg/lmd_wasm_bg.wasm?url";
import { DEMO } from "./demo.js";

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
    const title = lines[mk.line]
      .replace(ANCHOR_G, "")
      .replace(/^#+\s*/, "")
      .trim();
    return { slug: mk.slug, title, md };
  });
}

function preview(md: string): string {
  return md
    .split("\n")
    .slice(1) // drop the heading line
    .join(" ")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    core
      .init(wasmUrl)
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  const sections = useMemo(() => splitSections(DEMO), []);
  const bySlug = useMemo(() => new Map(sections.map((s) => [s.slug, s])), [sections]);

  // Outgoing local links per section, resolved from the built manifest.
  const [outgoing, setOutgoing] = useState<Map<string, { slug: string; rel: string }[]>>(new Map());
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const src = `---\nlmd: 1\nid: demo\nversion: 1\ntitle: Demo\n---\n\n${DEMO}\n`;
        const doc = await core.build(src);
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
        setError(String(e));
      }
    })();
  }, [ready, bySlug]);

  useEffect(() => {
    if (sections.length && history.length === 0) setHistory([sections[0].slug]);
  }, [sections, history.length]);

  const htmlCache = useRef(new Map<string, string>());
  function html(slug: string): string {
    const cached = htmlCache.current.get(slug);
    if (cached) return cached;
    const sec = bySlug.get(slug);
    const out = sec ? renderToHtml({ frontmatter: FM, body: sec.md }).html : "";
    htmlCache.current.set(slug, out);
    return out;
  }

  function navigate(slug: string) {
    if (!bySlug.has(slug)) return;
    setHistory((h) => [...h, slug]);
  }
  function back() {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }

  // Intercept clicks on inline lmd links in the center pane → navigate.
  function onCenterClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a.lmd-ref") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const addr = core.parseAddress(a.dataset.lmdTarget ?? "");
    if (addr.kind === "local") navigate(addr.slug);
  }

  if (error) return <div className="fatal">⚠ {error}</div>;
  if (!ready || history.length === 0) return <div className="loading">Loading…</div>;

  const currentSlug = history[history.length - 1];
  const prevSlug = history.length > 1 ? history[history.length - 2] : null;
  const current = bySlug.get(currentSlug)!;
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
              <span className={i === history.length - 1 ? "is-current" : ""}>
                {bySlug.get(slug)?.title ?? slug}
              </span>
            </span>
          ))}
        </nav>
      </header>

      <main className="cols">
        {/* LEFT — previous screen (history) */}
        <section className="col col--prev">
          <div className="col__label">Previous</div>
          {prevSlug ? (
            <button className="doc doc--ghost" onClick={back} title="Go back">
              <div className="doc__title">{bySlug.get(prevSlug)!.title}</div>
              <div className="doc__body" dangerouslySetInnerHTML={{ __html: html(prevSlug) }} />
              <div className="doc__hint">← back</div>
            </button>
          ) : (
            <div className="col__empty">You are at the start.</div>
          )}
        </section>

        {/* CENTER — current screen */}
        <section className="col col--current">
          <div className="col__label">
            {prevSlug && (
              <button className="backbtn" onClick={back} title="Back">
                ←
              </button>
            )}
            Reading
          </div>
          <article className="doc doc--current" onClick={onCenterClick}>
            <div className="doc__body" dangerouslySetInnerHTML={{ __html: html(currentSlug) }} />
          </article>
        </section>

        {/* RIGHT — anchors the current screen's links point to */}
        <section className="col col--links">
          <div className="col__label">
            Links out <span className="count">{links.length}</span>
          </div>
          {links.length === 0 ? (
            <div className="col__empty">This section has no outgoing links.</div>
          ) : (
            <ul className="cards">
              {links.map(({ slug, rel }) => {
                const sec = bySlug.get(slug)!;
                return (
                  <li key={slug}>
                    <button className="card" onClick={() => navigate(slug)}>
                      <div className="card__head">
                        <span className="card__title">{sec.title}</span>
                        <span className="card__rel">{rel}</span>
                      </div>
                      <div className="card__preview">{preview(sec.md)}</div>
                      <div className="card__go">open →</div>
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

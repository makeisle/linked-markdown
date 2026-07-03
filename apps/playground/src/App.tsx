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
const PALETTE = 4;

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
    .slice(0, 150);
}

const blockOf = (el: Element) => (el.closest("h1,h2,h3,h4,h5,h6,p,li") as HTMLElement) ?? (el as HTMLElement);

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(DEMO);
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const centerScroll = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement | null>());

  const focusRef = useRef<string | null>(null);
  const sectionsRef = useRef<Section[]>([]);
  const outgoingRef = useRef(new Map<string, { slug: string; rel: string }[]>());
  const colorRef = useRef(new Map<string, number>());

  useEffect(() => {
    core.init(wasmUrl).then(() => setReady(true)).catch((e) => setError(String(e)));
  }, []);

  const sections = useMemo(() => splitSections(body), [body]);
  const bySlug = useMemo(() => new Map(sections.map((s) => [s.slug, s])), [sections]);
  const docHtml = useMemo(() => renderToHtml({ frontmatter: FM, body }).html, [body]);
  const colorOf = useMemo(() => {
    const m = new Map<string, number>();
    sections.forEach((s, i) => m.set(s.slug, i % PALETTE));
    return m;
  }, [sections]);

  const [outgoing, setOutgoing] = useState<Map<string, { slug: string; rel: string }[]>>(new Map());
  sectionsRef.current = sections;
  outgoingRef.current = outgoing;
  colorRef.current = colorOf;

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

  // Colour every link in the document by its target's stable palette index.
  useEffect(() => {
    const root = centerRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLAnchorElement>("a.lmd-ref").forEach((a) => {
      const t = core.parseAddress(a.dataset.lmdTarget ?? "");
      if (t.kind === "local" && colorOf.has(t.slug)) {
        a.classList.add(`lc-${colorOf.get(t.slug)}`);
      }
    });
  }, [ready, docHtml, colorOf, editing]);

  const lineY = () => {
    const r = centerScroll.current!.getBoundingClientRect();
    return r.top + r.height / 2;
  };

  const nearestLink = (slug: string, y: number): HTMLElement | null => {
    let best: HTMLElement | null = null;
    let bd = Infinity;
    centerRef.current?.querySelectorAll<HTMLElement>(`a.lmd-ref[data-lmd-target=":${slug}"]`).forEach((e) => {
      const r = e.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    });
    return best;
  };

  const layoutCards = () => {
    const canvas = canvasRef.current;
    if (!canvas || !centerScroll.current) return;
    const cRect = canvas.getBoundingClientRect();
    const y0 = lineY();
    const links = outgoingRef.current.get(focusRef.current ?? "") ?? [];
    const items = links
      .map(({ slug }) => {
        const src = nearestLink(slug, y0);
        const el = cardRefs.current.get(slug);
        const h = el?.offsetHeight ?? 66;
        let srcY = cRect.height / 2;
        if (src) {
          const r = src.getBoundingClientRect();
          srcY = r.top + r.height / 2 - cRect.top;
        }
        return { slug, srcY, h, el };
      })
      .sort((a, b) => a.srcY - b.srcY);

    const gap = 12;
    let prevBottom = -1e9;
    for (const it of items) {
      let top = it.srcY - it.h / 2;
      if (top < prevBottom + gap) top = prevBottom + gap;
      top = Math.max(6, Math.min(top, cRect.height - it.h - 6));
      prevBottom = top + it.h;
      const center = top + it.h / 2;
      const dir = it.srcY < center - 6 ? "up" : it.srcY > center + 6 ? "down" : "mid";
      if (it.el) {
        it.el.style.top = `${top}px`;
        it.el.dataset.dir = dir;
      }
    }
  };

  const computeFocus = () => {
    const root = centerRef.current;
    if (!root || !centerScroll.current) return;
    const y0 = lineY();
    let best: string | null = null;
    let bd = Infinity;
    let bestBlock: HTMLElement | null = null;
    for (const s of sectionsRef.current) {
      const el = root.querySelector(`[data-lmd-anchor="${s.slug}"]`);
      if (!el) continue;
      const block = blockOf(el);
      const r = block.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - y0);
      if (d < bd) {
        bd = d;
        best = s.slug;
        bestBlock = block;
      }
    }
    if (best && bestBlock) {
      root.querySelectorAll(".lmd-focus").forEach((e) => e.classList.remove("lmd-focus"));
      bestBlock.classList.add("lmd-focus");
      if (best !== focusRef.current) {
        focusRef.current = best;
        setFocusSlug(best);
      }
    }
  };

  // Scroll listener: recompute focus + reposition cards as the reader scrolls.
  useEffect(() => {
    const sc = centerScroll.current;
    if (!sc || editing) return;
    const onScroll = () => {
      computeFocus();
      layoutCards();
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, editing, docHtml]);

  // Center the first anchor once loaded, then let scroll drive focus.
  useEffect(() => {
    if (!ready || editing || !sections.length) return;
    const t = setTimeout(() => {
      if (!focusRef.current) {
        const el = centerRef.current?.querySelector(`[data-lmd-anchor="${sections[0].slug}"]`);
        if (el) blockOf(el).scrollIntoView({ block: "center" });
      }
      computeFocus();
      layoutCards();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, docHtml, editing, outgoing]);

  // Reposition cards whenever the card set changes.
  useEffect(() => {
    layoutCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSlug, outgoing]);

  function focusOn(slug: string) {
    const el = centerRef.current?.querySelector(`[data-lmd-anchor="${slug}"]`);
    if (el) blockOf(el).scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function onCenterClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a.lmd-ref") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const addr = core.parseAddress(a.dataset.lmdTarget ?? "");
    if (addr.kind === "local") focusOn(addr.slug);
  }

  if (error) return <div className="fatal">⚠ {error}</div>;
  if (!ready) return <div className="loading">Loading…</div>;

  const current = focusSlug ? bySlug.get(focusSlug) : sections[0];
  const links = focusSlug ? outgoing.get(focusSlug) ?? [] : [];

  return (
    <div className="reader reader--2col">
      <header className="reader__bar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ⬡
          </span>
          <span className="brand__name">Linked Markdown</span>
          <span className="brand__tag">reader</span>
        </div>
        <div className="focusnow">
          Focused on <span className="focustag">{current?.title}</span>
        </div>
      </header>

      <main className="cols cols--2">
        <section className="col col--current">
          <div className="col__label">
            Document
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
              onSave={(b) => {
                setBody(b);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="doc doc--current" ref={centerScroll}>
              <div className="focusline" aria-hidden />
              <article className="doc__body" ref={centerRef} onClick={onCenterClick} dangerouslySetInnerHTML={{ __html: docHtml }} />
            </div>
          )}
        </section>

        <section className="col col--links">
          <div className="col__label">
            Links from <span className="focustag">{current?.title}</span>
            <span className="count">{links.length}</span>
          </div>
          <div className="cards-canvas" ref={canvasRef}>
            {links.length === 0 && <div className="col__empty">This section links nowhere.</div>}
            {links.map(({ slug, rel }) => {
              const sec = bySlug.get(slug)!;
              const ci = colorOf.get(slug) ?? 0;
              return (
                <button
                  key={slug}
                  ref={(el) => cardRefs.current.set(slug, el)}
                  className={`card lc-${ci}`}
                  data-dir="mid"
                  onClick={() => focusOn(slug)}
                >
                  <span className="needle" aria-hidden />
                  <div className="card__head">
                    <span className="card__title">{sec.title}</span>
                    <span className="card__rel">{rel}</span>
                  </div>
                  <div className="card__preview">{preview(sec.md)}</div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

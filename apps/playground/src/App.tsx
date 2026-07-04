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
interface LinkCard {
  id: number;
  srcId: number;
  slug: string;
  rel: string;
}

const ANCHOR = /<!--lmd:a\s+([a-z][a-z0-9-]*)[^>]*-->/;
const ANCHOR_G = /<!--lmd:a\s+([a-z][a-z0-9-]*)[^>]*-->/g;
const FM: core.Frontmatter = { lmd: 1, id: "demo", version: 1, title: "Demo" };
const PALETTE = 4;
const PALETTE_HEX = ["#7c9cff", "#5fd6a6", "#f2b45e", "#e78bd0"];

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
    .slice(0, 110);
}

const blockOf = (el: Element) => (el.closest("h1,h2,h3,h4,h5,h6,p,li") as HTMLElement) ?? (el as HTMLElement);

function focusIn(root: HTMLElement | null, slug: string, smooth: boolean) {
  if (!root) return;
  root.querySelectorAll(".lmd-focus").forEach((e) => e.classList.remove("lmd-focus"));
  const el = root.querySelector(`[data-lmd-anchor="${slug}"]`);
  if (!el) return;
  const block = blockOf(el);
  block.classList.add("lmd-focus");
  block.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(DEMO);
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  // Navigation back-stack of anchors you jumped to by clicking. Scrolling does
  // not touch this — only explicit navigation does.
  const [stack, setStack] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [linkCards, setLinkCards] = useState<LinkCard[]>([]);

  const centerScroll = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wiresRef = useRef<SVGSVGElement>(null);
  const cardRefs = useRef(new Map<number, HTMLButtonElement | null>());

  const focusRef = useRef<string | null>(null);
  const sectionsRef = useRef<Section[]>([]);
  const linkCardsRef = useRef<LinkCard[]>([]);
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

  sectionsRef.current = sections;
  linkCardsRef.current = linkCards;
  colorRef.current = colorOf;

  // Tag + colour every link in both panes; collect the full card list (all links).
  useEffect(() => {
    if (!ready) return;
    const paint = (root: HTMLElement | null, collect: boolean) => {
      const list: LinkCard[] = [];
      let srcId = 0;
      let cardId = 0;
      // Every source is either a visible link (one target) or an invisible
      // relation span (possibly many targets). Each (source, target) is a card.
      root?.querySelectorAll<HTMLElement>("a.lmd-ref, .lmd-relsrc").forEach((el) => {
        const targets: { slug: string; rel: string }[] = [];
        if (el.matches("a.lmd-ref")) {
          const t = core.parseAddress(el.dataset.lmdTarget ?? "");
          if (t.kind === "local" && colorOf.has(t.slug)) {
            el.classList.add(`lc-${colorOf.get(t.slug)}`);
            targets.push({ slug: t.slug, rel: "related" });
          }
        } else {
          const inner = el.getAttribute("data-lmd-rel") ?? "";
          for (const m of inner.matchAll(/([a-z_]+)=([^\s]+)/g)) {
            for (const addr of m[2].split(",")) {
              const t = core.parseAddress(addr);
              if (t.kind === "local" && colorOf.has(t.slug)) targets.push({ slug: t.slug, rel: m[1] });
            }
          }
        }
        if (collect && targets.length) {
          el.dataset.srcId = String(srcId);
          for (const t of targets) list.push({ id: cardId++, srcId, slug: t.slug, rel: t.rel });
        }
        srcId++;
      });
      return list;
    };
    setLinkCards(paint(centerRef.current, true));
    paint(prevRef.current, false);
  }, [ready, docHtml, colorOf, editing]);

  const layoutCards = () => {
    const canvas = canvasRef.current;
    const root = centerRef.current;
    if (!canvas || !root) return;
    const cRect = canvas.getBoundingClientRect();
    const midY = cRect.height / 2;
    const visible: { el: HTMLButtonElement; src: HTMLElement; slug: string; srcY: number; h: number }[] = [];
    for (const card of linkCardsRef.current) {
      const el = cardRefs.current.get(card.id);
      if (!el) continue;
      const src = root.querySelector<HTMLElement>(`[data-src-id="${card.srcId}"]`);
      if (!src) {
        el.style.display = "none";
        continue;
      }
      const r = src.getBoundingClientRect();
      const srcY = r.top + r.height / 2 - cRect.top;
      if (srcY < -40 || srcY > cRect.height + 40) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "";
      visible.push({ el, src, slug: card.slug, srcY, h: el.offsetHeight || 58 });
    }
    visible.sort((a, b) => a.srcY - b.srcY);
    const gap = 8;
    let prevBottom = -1e9;
    for (const it of visible) {
      let top = it.srcY - it.h / 2;
      if (top < prevBottom + gap) top = prevBottom + gap;
      top = Math.max(4, Math.min(top, cRect.height - it.h - 4));
      prevBottom = top + it.h;
      it.el.style.top = `${top}px`;
      it.el.style.opacity = String(Math.max(0.4, 1 - (Math.abs(top + it.h / 2 - midY) / midY) * 0.7));
    }
    drawWires(visible);
  };

  // Draw a leader line from each card to its source link's height on the
  // document's right edge. Purely visual, redrawn on every layout/scroll.
  const drawWires = (visible: { el: HTMLButtonElement; src: HTMLElement; slug: string }[]) => {
    const svg = wiresRef.current;
    const pane = centerScroll.current;
    if (!svg || !pane) return;
    const sr = svg.getBoundingClientRect();
    const pr = pane.getBoundingClientRect();
    const parts: string[] = [];
    for (const it of visible) {
      const lr = it.src.getBoundingClientRect();
      const sy = Math.max(pr.top + 6, Math.min(lr.top + lr.height / 2, pr.bottom - 6)) - sr.top;
      const sx = pr.right - sr.left;
      const cr = it.el.getBoundingClientRect();
      const tx = cr.left - sr.left;
      const ty = cr.top + cr.height / 2 - sr.top;
      const col = PALETTE_HEX[colorRef.current.get(it.slug) ?? 0];
      const dx = Math.max(24, (tx - sx) * 0.5);
      const op = it.el.style.opacity || "1";
      parts.push(
        `<path d="M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}" fill="none" stroke="${col}" stroke-width="1.6" opacity="${op}"/>`,
        `<circle cx="${sx}" cy="${sy}" r="3" fill="${col}" opacity="${op}"/>`,
      );
    }
    svg.innerHTML = parts.join("");
  };

  const computeFocus = () => {
    const root = centerRef.current;
    const sc = centerScroll.current;
    if (!root || !sc) return;
    const r = sc.getBoundingClientRect();
    const lineY = r.top + r.height / 2;
    let best: string | null = null;
    let bd = Infinity;
    let bestBlock: HTMLElement | null = null;
    for (const s of sectionsRef.current) {
      const el = root.querySelector(`[data-lmd-anchor="${s.slug}"]`);
      if (!el) continue;
      const block = blockOf(el);
      const br = block.getBoundingClientRect();
      const d = Math.abs(br.top + br.height / 2 - lineY);
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

  useEffect(() => {
    const sc = centerScroll.current;
    if (!sc || !ready || editing) return;
    const onScroll = () => {
      computeFocus();
      layoutCards();
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, editing, docHtml]);

  // Initial centering, then focus follows scroll.
  useEffect(() => {
    if (!ready || editing || !sections.length) return;
    const t = setTimeout(() => {
      if (!focusRef.current) focusIn(centerRef.current, sections[0].slug, false);
      computeFocus();
      layoutCards();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, docHtml, editing, linkCards]);

  useEffect(() => {
    layoutCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCards]);

  const leftSlug = stack.length > 1 ? stack[stack.length - 2] : null;

  // Initialize the back-stack once the document is ready.
  useEffect(() => {
    if (sections.length && stack.length === 0) setStack([sections[0].slug]);
  }, [sections, stack.length]);

  // Left pane mirrors the back-stack's previous entry, centered.
  useEffect(() => {
    if (leftSlug) focusIn(prevRef.current, leftSlug, false);
  }, [leftSlug, docHtml]);

  function scrollTo(slug: string) {
    focusIn(centerRef.current, slug, true);
    setTimeout(() => {
      computeFocus();
      layoutCards();
    }, 260);
  }
  // Explicit navigation (click): push onto the back-stack, then scroll there.
  function goto(slug: string) {
    if (stack[stack.length - 1] !== slug) setStack([...stack, slug]);
    scrollTo(slug);
  }
  function back() {
    if (stack.length < 2) return;
    const ns = stack.slice(0, -1);
    setStack(ns);
    scrollTo(ns[ns.length - 1]);
  }
  function onCenterClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a.lmd-ref") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const addr = core.parseAddress(a.dataset.lmdTarget ?? "");
    if (addr.kind === "local") goto(addr.slug);
  }

  if (error) return <div className="fatal">⚠ {error}</div>;
  if (!ready) return <div className="loading">Loading…</div>;

  const current = focusSlug ? bySlug.get(focusSlug) : sections[0];

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
        <div className="focusnow">
          Focused on <span className="focustag">{current?.title}</span>
        </div>
      </header>

      <main className="cols cols--3">
        <svg className="wires" ref={wiresRef} aria-hidden />
        <section className="col col--prev">
          <div className="col__label">
            Previous
            {leftSlug && (
              <button className="editbtn" onClick={back} title="Back">
                ← back
              </button>
            )}
          </div>
          {leftSlug ? (
            <div className="doc-wrap">
              <div className="focusline focusline--sm" aria-hidden />
              <div className="doc doc--ghost" onClick={back} title="Go back">
                <article className="doc__body" ref={prevRef} dangerouslySetInnerHTML={{ __html: docHtml }} />
              </div>
              <div className="doc__badge">{bySlug.get(leftSlug)?.title} · ← back</div>
            </div>
          ) : (
            <div className="col__empty">No history yet — follow a link to build it.</div>
          )}
        </section>

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
            <div className="doc-wrap">
              <div className="focusline" aria-hidden />
              <div className="doc doc--current" ref={centerScroll}>
                <article className="doc__body" ref={centerRef} onClick={onCenterClick} dangerouslySetInnerHTML={{ __html: docHtml }} />
              </div>
            </div>
          )}
        </section>

        <section className="col col--links">
          <div className="col__label">Links near focus</div>
          <div className="cards-canvas" ref={canvasRef}>
            {linkCards.map((card) => {
              const sec = bySlug.get(card.slug);
              const ci = colorOf.get(card.slug) ?? 0;
              return (
                <button
                  key={card.id}
                  ref={(el) => cardRefs.current.set(card.id, el)}
                  className={`card lc-${ci}`}
                  data-dir="mid"
                  style={{ display: "none" }}
                  onClick={() => goto(card.slug)}
                >
                  <span className="card__title">{sec?.title ?? card.slug}</span>
                  <span className="card__preview">{sec ? preview(sec.md) : ""}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

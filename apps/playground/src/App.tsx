import * as core from "@lmd/core";
import { renderToHtml } from "@lmd/viewer";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import wasmUrl from "@lmd/core/pkg/lmd_wasm_bg.wasm?url";
import { DEMO } from "./demo.js";
import { EditorShell } from "./EditorShell.js";

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
  /** Palette index of the source ref — shared by its text, cards and wires. */
  color: number;
}

const ANCHOR = /<!--lmd:a\s+([a-z][a-z0-9-]*)[^>]*-->/;
const ANCHOR_G = /<!--lmd:a\s+([a-z][a-z0-9-]*)[^>]*-->/g;
// Import table: alias → { id (durable UUID), path (drift-prone hint) }. `policy`
// points at a stale path on purpose — the file was reorganized into `policy/v2/`
// — so the editor sidebar can demonstrate UUID-based move detection.
const IMPORTS: Record<string, core.Import> = {
  design: { id: "0192f3a1-d0d0-7000-9000-00000design01", path: "design/architecture.lmd", pin: "@7" },
  policy: { id: "0192f3a1-d0d0-7000-9000-00000policy01", path: "policy/security.lmd", pin: "@2" },
  glossary: { id: "0192f3a1-d0d0-7000-9000-0000glossary1", path: "reference/glossary.lmd" },
  // A dangling import — its UUID is nowhere in the workspace — so the sidebar can
  // demonstrate the "not found → keep or delete links" flow.
  legacy: { id: "0192f3a1-d0d0-7000-9000-00000legacy01", path: "archive/old-spec.lmd", pin: "@1" },
};
const FM: core.Frontmatter = { lmd: 1, id: "demo", version: 1, title: "Demo", imports: IMPORTS };
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

/** Parse a ref's `data-lmd-targets` (`[role=]addr,… …`) into local targets. */
function refTargets(s: string): { rel: string; slug: string }[] {
  const out: { rel: string; slug: string }[] = [];
  for (const item of s.split(/\s+/).filter(Boolean)) {
    const eq = item.indexOf("=");
    const rel = eq > 0 ? item.slice(0, eq) : "related";
    for (const addr of (eq > 0 ? item.slice(eq + 1) : item).split(",")) {
      if (!addr) continue;
      const a = core.parseAddress(addr);
      if (a.kind === "local") out.push({ rel, slug: a.slug });
    }
  }
  return out;
}

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

  useEffect(() => {
    core.init(wasmUrl).then(() => setReady(true)).catch((e) => setError(String(e)));
  }, []);

  const sections = useMemo(() => splitSections(body), [body]);
  const bySlug = useMemo(() => new Map(sections.map((s) => [s.slug, s])), [sections]);
  const docHtml = useMemo(() => renderToHtml({ frontmatter: FM, body }).html, [body]);

  sectionsRef.current = sections;
  linkCardsRef.current = linkCards;

  // Colour every ref by its own palette index — the ref's text, its card(s) and
  // its wire(s) all share that colour. Collect one card per (ref, target).
  useEffect(() => {
    if (!ready) return;
    const paint = (root: HTMLElement | null, collect: boolean) => {
      const list: LinkCard[] = [];
      let idx = 0; // index among refs with local targets → the ref's colour
      let cardId = 0;
      root?.querySelectorAll<HTMLElement>(".lmd-ref").forEach((el) => {
        const targets = refTargets(el.getAttribute("data-lmd-targets") ?? "").filter((t) =>
          bySlug.has(t.slug),
        );
        if (!targets.length) return;
        const color = idx % PALETTE;
        el.classList.add(`lc-${color}`);
        if (collect) {
          el.dataset.srcId = String(idx);
          for (const t of targets) list.push({ id: cardId++, srcId: idx, slug: t.slug, rel: t.rel, color });
        }
        idx++;
      });
      return list;
    };
    setLinkCards(paint(centerRef.current, true));
    paint(prevRef.current, false);
  }, [ready, docHtml, bySlug, editing]);

  const layoutCards = () => {
    const canvas = canvasRef.current;
    const root = centerRef.current;
    const pane = centerScroll.current;
    if (!canvas || !root || !pane) return;
    const cRect = canvas.getBoundingClientRect();
    const H = cRect.height;
    // The focus line: the pane's vertical centre, in canvas coordinates.
    const midY = pane.getBoundingClientRect().top + pane.getBoundingClientRect().height / 2 - cRect.top;

    // Only refs whose source is on-screen get a card, positioned at the source's
    // height (top = srcY − h/2).
    type Item = { el: HTMLButtonElement; src: HTMLElement; color: number; srcY: number; h: number; top: number };
    const items: Item[] = [];
    for (const card of linkCardsRef.current) {
      const el = cardRefs.current.get(card.id);
      if (!el) continue;
      const src = root.querySelector<HTMLElement>(`[data-src-id="${card.srcId}"]`);
      const r = src?.getBoundingClientRect();
      const srcY = r ? r.top + r.height / 2 - cRect.top : -1;
      if (!src || srcY < 0 || srcY > H) {
        el.style.display = "none";
        continue;
      }
      const h = el.offsetHeight || 58;
      items.push({ el, src, color: card.color, srcY, h, top: srcY - h / 2 });
    }
    items.sort((a, b) => a.srcY - b.srcY);

    // Resolve overlaps by spreading *outward from the focus line*: the card whose
    // source is nearest the line keeps its place; cards above are pushed up in
    // distance order, cards below pushed down.
    const gap = 8;
    if (items.length) {
      let pivot = 0;
      let best = Infinity;
      items.forEach((it, i) => {
        const d = Math.abs(it.srcY - midY);
        if (d < best) {
          best = d;
          pivot = i;
        }
      });
      for (let i = pivot + 1; i < items.length; i++) {
        items[i].top = Math.max(items[i].top, items[i - 1].top + items[i - 1].h + gap);
      }
      for (let i = pivot - 1; i >= 0; i--) {
        items[i].top = Math.min(items[i].top, items[i + 1].top - gap - items[i].h);
      }
    }

    const shown: Item[] = [];
    for (const it of items) {
      // Overflow past the top/bottom of the column is hidden.
      if (it.top < 4 || it.top + it.h > H - 4) {
        it.el.style.display = "none";
        continue;
      }
      it.el.style.display = "";
      it.el.style.top = `${it.top}px`;
      it.el.style.opacity = String(Math.max(0.5, 1 - (Math.abs(it.top + it.h / 2 - midY) / midY) * 0.5));
      shown.push(it);
    }
    drawWires(shown);
  };

  // Draw a leader line from each card to its source link's height on the
  // document's right edge. Purely visual, redrawn on every layout/scroll.
  const drawWires = (visible: { el: HTMLButtonElement; src: HTMLElement; color: number }[]) => {
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
      const col = PALETTE_HEX[it.color] ?? PALETTE_HEX[0];
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
    const el = (e.target as HTMLElement).closest(".lmd-ref") as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    const first = refTargets(el.getAttribute("data-lmd-targets") ?? "")[0];
    if (first) goto(first.slug);
  }

  if (error) return <div className="fatal">⚠ {error}</div>;
  if (!ready) return <div className="loading">Loading…</div>;

  // Editing takes over the whole screen — no reader columns.
  if (editing) {
    return (
      <EditorShell
        initial={body}
        anchors={sections.map((s) => ({ slug: s.slug, title: s.title }))}
        imports={IMPORTS}
        onSave={(b) => {
          setBody(b);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

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
            <button className="editbtn" onClick={() => setEditing(true)}>
              ✎ Edit
            </button>
          </div>
          <div className="doc-wrap">
            <div className="focusline" aria-hidden />
            <div className="doc doc--current" ref={centerScroll}>
              <article className="doc__body" ref={centerRef} onClick={onCenterClick} dangerouslySetInnerHTML={{ __html: docHtml }} />
            </div>
          </div>
        </section>

        <section className="col col--links">
          <div className="col__label">Links near focus</div>
          <div className="cards-canvas" ref={canvasRef}>
            {linkCards.map((card) => {
              const sec = bySlug.get(card.slug);
              return (
                <button
                  key={card.id}
                  ref={(el) => cardRefs.current.set(card.id, el)}
                  className={`card lc-${card.color}`}
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

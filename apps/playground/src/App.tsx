import * as core from "@lmd/core";
import { renderToHtml } from "@lmd/viewer";
import * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import wasmUrl from "@lmd/core/pkg/lmd_wasm_bg.wasm?url";
import { DEMO } from "./demo.js";
import { EditorShell } from "./EditorShell.js";
import { Logo } from "./Logo.js";
import { workspace, type WsDoc } from "./workspace.js";

interface Section {
  slug: string;
  title: string;
  md: string;
}
interface LinkCard {
  id: number;
  srcId: number;
  /** local: the target section slug; cross: the target anchor slug. */
  slug: string;
  rel: string;
  /** Palette index of the source ref — shared by its text, cards and wires. */
  color: number;
  kind: "local" | "cross";
  /** Cross-doc only: import alias + target document, for the modal. */
  alias?: string;
  docUuid?: string;
  /** Resolved display strings (section/anchor title + preview/subtitle). */
  title: string;
  preview: string;
}

type RefTarget =
  | { kind: "local"; rel: string; slug: string }
  | { kind: "cross"; rel: string; alias: string; slug: string };

/** A card shown in the compact viewer's hover tooltip. */
interface TipCard {
  kind: "local" | "cross";
  slug: string;
  alias?: string;
  docUuid?: string;
  title: string;
  preview: string;
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
const MAIN_KEY = "main";
const PALETTE = 4;

/** A back-stack entry: which document is in view, and the focused anchor. */
interface NavEntry {
  key: string; // MAIN_KEY or an imported doc's UUID
  slug: string;
}
// Sandevaux hues — teal, sand, info-blue, run-green — for distinguishing links.
const PALETTE_HEX = ["#4795AE", "#D1A987", "#3E73C9", "#19A974"];

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

/** Parse a ref's `data-lmd-targets` (`[role=]addr,… …`) into local + cross targets. */
function refTargets(s: string): RefTarget[] {
  const out: RefTarget[] = [];
  for (const item of s.split(/\s+/).filter(Boolean)) {
    const eq = item.indexOf("=");
    const rel = eq > 0 ? item.slice(0, eq) : "related";
    for (const addr of (eq > 0 ? item.slice(eq + 1) : item).split(",")) {
      if (!addr) continue;
      const a = core.parseAddress(addr);
      if (a.kind === "local") out.push({ kind: "local", rel, slug: a.slug });
      else if (a.kind === "cross") out.push({ kind: "cross", rel, alias: a.alias, slug: a.target });
    }
  }
  return out;
}

/** Resolve a cross-doc target through the import table + workspace. */
function resolveCross(alias: string, slug: string): { doc: WsDoc; title: string } | null {
  const imp = IMPORTS[alias];
  if (!imp) return null;
  const doc = workspace.findByUuid(imp.id);
  const anchor = doc?.anchors.find((a) => a.slug === slug);
  return doc && anchor ? { doc, title: anchor.title } : null;
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
  // Which document fills the centre column, and the imported docs we've loaded.
  const [viewKey, setViewKey] = useState(MAIN_KEY);
  const [crossDocs, setCrossDocs] = useState<Map<string, WsDoc>>(new Map());
  // Navigation back-stack of (document, anchor) you jumped to by clicking.
  // Scrolling does not touch this — only explicit navigation does.
  const [stack, setStack] = useState<NavEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [linkCards, setLinkCards] = useState<LinkCard[]>([]);
  // The ref index (src-id) currently hovered — via its link text or its card.
  // Both the link and its card(s) light up, and the wire between them thickens.
  const [hotSrc, setHotSrc] = useState<number | null>(null);
  // Compact layout: center-only reader (links as a hover tooltip) + collapsible
  // editor wing. Persisted so the choice sticks across reloads.
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem("lmd-compact") === "1";
    } catch {
      return false;
    }
  });
  // The tooltip stores the anchor link's rect; final placement (flip above /
  // below + clamp) is computed after render from the tooltip's measured size.
  const [tip, setTip] = useState<{ cards: TipCard[]; rect: { top: number; bottom: number; left: number } } | null>(null);

  const centerScroll = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wiresRef = useRef<SVGSVGElement>(null);
  const cardRefs = useRef(new Map<number, HTMLButtonElement | null>());

  const focusRef = useRef<string | null>(null);
  // A slug to focus once the *next* render lands (used when the view swaps to a
  // different document, whose DOM doesn't exist yet at click time).
  const pendingRef = useRef<string | null>(null);
  const sectionsRef = useRef<Section[]>([]);
  const linkCardsRef = useRef<LinkCard[]>([]);
  const hotSrcRef = useRef<number | null>(null);
  const lastShownRef = useRef<{ el: HTMLButtonElement; src: HTMLElement; color: number; srcId: number }[]>([]);
  const tipTimer = useRef<number | null>(null);
  const tipElRef = useRef<HTMLElement | null>(null);
  const tipBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    core.init(wasmUrl).then(() => setReady(true)).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lmd-compact", compact ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [compact]);

  // Position the link tooltip after it renders: measure it, prefer below the
  // link, flip above when it would overflow the bottom, and clamp horizontally.
  useLayoutEffect(() => {
    const el = tipBoxRef.current;
    if (!el || !tip) return;
    const gap = 6;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    let top = tip.rect.bottom + gap;
    if (top + h > vh - 12) {
      const above = tip.rect.top - gap - h;
      top = above >= 12 ? above : Math.max(12, vh - 12 - h);
    }
    const left = Math.max(12, Math.min(tip.rect.left, vw - w - 12));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = "visible";
  }, [tip]);

  // The document currently in the centre column — the editable main doc, or a
  // read-only imported one we've navigated into.
  const docReg = (key: string): { title: string; body: string; editable: boolean; id: string } => {
    if (key === MAIN_KEY) return { title: FM.title, body, editable: true, id: FM.id };
    const d = crossDocs.get(key);
    return d
      ? { title: d.title, body: d.body, editable: false, id: d.uuid }
      : { title: "(missing)", body: "", editable: false, id: key };
  };
  const view = docReg(viewKey);

  const sections = useMemo(() => splitSections(view.body), [view.body]);
  const bySlug = useMemo(() => new Map(sections.map((s) => [s.slug, s])), [sections]);
  const docHtml = useMemo(() => {
    const fm: core.Frontmatter =
      viewKey === MAIN_KEY ? FM : { lmd: 1, id: view.id, version: 1, title: view.title };
    return renderToHtml({ frontmatter: fm, body: view.body }).html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.body]);

  sectionsRef.current = sections;
  linkCardsRef.current = linkCards;
  hotSrcRef.current = hotSrc;

  // Colour every ref by its own palette index — the ref's text, its card(s) and
  // its wire(s) all share that colour. Collect one card per (ref, target). Both
  // local (same-document) and cross-document (`alias:slug`) targets get a card.
  useEffect(() => {
    if (!ready) return;
    const paint = (root: HTMLElement | null, collect: boolean) => {
      const list: LinkCard[] = [];
      let idx = 0; // index among refs with a resolvable target → the ref's colour
      let cardId = 0;
      root?.querySelectorAll<HTMLElement>(".lmd-ref").forEach((el) => {
        const raw = refTargets(el.getAttribute("data-lmd-targets") ?? "");
        const targets = raw.filter((t) => (t.kind === "local" ? bySlug.has(t.slug) : !!resolveCross(t.alias, t.slug)));
        if (!targets.length) return;
        const color = idx % PALETTE;
        el.classList.add(`lc-${color}`);
        if (targets.every((t) => t.kind === "cross")) el.classList.add("is-cross");
        if (collect) {
          el.dataset.srcId = String(idx);
          for (const t of targets) {
            if (t.kind === "local") {
              const sec = bySlug.get(t.slug);
              list.push({
                id: cardId++, srcId: idx, color, kind: "local", slug: t.slug, rel: t.rel,
                title: sec?.title ?? t.slug, preview: sec ? preview(sec.md) : "",
              });
            } else {
              const r = resolveCross(t.alias, t.slug)!;
              list.push({
                id: cardId++, srcId: idx, color, kind: "cross", slug: t.slug, rel: t.rel,
                alias: t.alias, docUuid: r.doc.uuid, title: r.title, preview: r.doc.title,
              });
            }
          }
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
    type Item = { el: HTMLButtonElement; src: HTMLElement; color: number; srcId: number; srcY: number; h: number; top: number };
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
      items.push({ el, src, color: card.color, srcId: card.srcId, srcY, h, top: srcY - h / 2 });
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
      const isHot = it.srcId === hotSrcRef.current;
      it.el.style.opacity = isHot ? "1" : String(Math.max(0.5, 1 - (Math.abs(it.top + it.h / 2 - midY) / midY) * 0.5));
      shown.push(it);
    }
    lastShownRef.current = shown;
    drawWires(shown);
  };

  // Draw a leader line from each card to its source link's height on the
  // document's right edge. Purely visual, redrawn on every layout/scroll.
  const drawWires = (visible: { el: HTMLButtonElement; src: HTMLElement; color: number; srcId: number }[]) => {
    const svg = wiresRef.current;
    const pane = centerScroll.current;
    if (!svg || !pane) return;
    const sr = svg.getBoundingClientRect();
    const pr = pane.getBoundingClientRect();
    const hot = hotSrcRef.current;
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
      const isHot = hot != null && it.srcId === hot;
      const op = isHot ? "1" : it.el.style.opacity || "1";
      const w = isHot ? 2.8 : 1.6;
      parts.push(
        `<path d="M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}" fill="none" stroke="${col}" stroke-width="${w}" opacity="${op}"/>`,
        `<circle cx="${sx}" cy="${sy}" r="${isHot ? 4.2 : 3}" fill="${col}" opacity="${op}"/>`,
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

  // Initial centering, then focus follows scroll. When the view swapped to a new
  // document, `pendingRef` names the anchor to land on.
  useEffect(() => {
    if (!ready || editing || !sections.length) return;
    const t = setTimeout(() => {
      if (pendingRef.current) {
        const want = pendingRef.current;
        pendingRef.current = null;
        focusRef.current = want;
        setFocusSlug(want);
        focusIn(centerRef.current, want, false);
      } else if (!focusRef.current) {
        focusIn(centerRef.current, sections[0].slug, false);
      }
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

  // Hovering a link or its card lights up the source link text and the wire.
  useEffect(() => {
    const root = centerRef.current;
    if (root) {
      root.querySelectorAll(".lmd-ref--hot").forEach((e) => e.classList.remove("lmd-ref--hot"));
      if (hotSrc != null) {
        root.querySelectorAll(`[data-src-id="${hotSrc}"]`).forEach((e) => e.classList.add("lmd-ref--hot"));
      }
    }
    layoutCards(); // repositions (deterministic) + sets hot opacity + redraws wires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotSrc]);

  const leftEntry = stack.length > 1 ? stack[stack.length - 2] : null;
  const leftReg = leftEntry ? docReg(leftEntry.key) : null;
  const leftHtml = useMemo(() => {
    if (!leftEntry || !leftReg || !leftReg.body) return "";
    const fm: core.Frontmatter =
      leftEntry.key === MAIN_KEY ? FM : { lmd: 1, id: leftReg.id, version: 1, title: leftReg.title };
    return renderToHtml({ frontmatter: fm, body: leftReg.body }).html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftEntry?.key, leftReg?.body]);

  // Initialize the back-stack once the document is ready.
  useEffect(() => {
    if (sections.length && stack.length === 0 && viewKey === MAIN_KEY) {
      setStack([{ key: MAIN_KEY, slug: sections[0].slug }]);
    }
  }, [sections, stack.length, viewKey]);

  // Left pane mirrors the back-stack's previous entry, centered.
  useEffect(() => {
    if (leftEntry) focusIn(prevRef.current, leftEntry.slug, false);
  }, [leftEntry?.key, leftEntry?.slug, leftHtml]);

  function scrollTo(slug: string) {
    focusIn(centerRef.current, slug, true);
    setTimeout(() => {
      computeFocus();
      layoutCards();
    }, 260);
  }
  // Push a navigation entry, first syncing the entry we're *leaving* to our
  // actual scroll focus — so "back" returns to where we were, not where we
  // entered this document.
  function pushEntry(next: NavEntry) {
    const cur = focusRef.current; // capture now — gotoDoc nulls it right after
    const from = viewKey;
    setStack((prev) => {
      const s = [...prev];
      if (s.length && s[s.length - 1].key === from && cur) s[s.length - 1] = { key: from, slug: cur };
      const top = s[s.length - 1];
      if (!top || top.key !== next.key || top.slug !== next.slug) s.push(next);
      return s;
    });
  }
  // Navigate within the current view (same document): push + scroll.
  function goto(slug: string) {
    pushEntry({ key: viewKey, slug });
    scrollTo(slug);
  }
  // Navigate into another document — it takes over the centre column, focused on
  // `slug`, and the one you left becomes the "Previous" pane. Same as a local
  // link, just across a document boundary.
  function gotoDoc(doc: WsDoc, slug: string) {
    if (doc.uuid === viewKey) {
      goto(slug);
      return;
    }
    setCrossDocs((m) => (m.has(doc.uuid) ? m : new Map(m).set(doc.uuid, doc)));
    pushEntry({ key: doc.uuid, slug }); // reads focusRef under the *leaving* view
    focusRef.current = null;
    pendingRef.current = slug;
    setViewKey(doc.uuid);
  }
  function back() {
    if (stack.length < 2) return;
    const ns = stack.slice(0, -1);
    const target = ns[ns.length - 1];
    setStack(ns);
    if (target.key !== viewKey) {
      focusRef.current = null;
      pendingRef.current = target.slug;
      setViewKey(target.key);
    } else {
      scrollTo(target.slug);
    }
  }
  function followTarget(t: RefTarget) {
    if (t.kind === "cross") {
      const r = resolveCross(t.alias, t.slug);
      if (r) gotoDoc(r.doc, t.slug);
    } else {
      goto(t.slug);
    }
  }
  function onCenterClick(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest(".lmd-ref") as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    const first = refTargets(el.getAttribute("data-lmd-targets") ?? "")[0];
    if (first) followTarget(first);
  }
  // ── Compact viewer: link → anchor-card tooltip ──────────────────────────
  function cancelHideTip() {
    if (tipTimer.current) {
      clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }
  }
  function hideTipSoon() {
    cancelHideTip();
    tipTimer.current = window.setTimeout(() => {
      setTip(null);
      tipElRef.current = null;
    }, 150);
  }
  function showTip(el: HTMLElement) {
    const cm = el.className.match(/lc-(\d)/);
    const color = cm ? Number(cm[1]) : 0;
    const cards: TipCard[] = [];
    for (const t of refTargets(el.getAttribute("data-lmd-targets") ?? "")) {
      if (t.kind === "local") {
        const sec = bySlug.get(t.slug);
        if (sec) cards.push({ kind: "local", slug: t.slug, title: sec.title, preview: preview(sec.md), color });
      } else {
        const r = resolveCross(t.alias, t.slug);
        if (r) cards.push({ kind: "cross", slug: t.slug, alias: t.alias, docUuid: r.doc.uuid, title: r.title, preview: r.doc.title, color });
      }
    }
    if (!cards.length) {
      hideTipSoon();
      return;
    }
    const r = el.getBoundingClientRect();
    setTip({ cards, rect: { top: r.top, bottom: r.bottom, left: r.left } });
  }

  function onCenterClickTip(c: TipCard) {
    if (c.kind === "cross") {
      const d = crossDocs.get(c.docUuid!) ?? workspace.findByUuid(c.docUuid!);
      if (d) gotoDoc(d, c.slug);
    } else {
      goto(c.slug);
    }
    setTip(null);
    tipElRef.current = null;
  }

  function onCenterOver(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest(".lmd-ref") as HTMLElement | null;
    if (compact) {
      if (el) {
        cancelHideTip();
        if (el !== tipElRef.current) {
          tipElRef.current = el;
          showTip(el);
        }
      } else {
        tipElRef.current = null;
        hideTipSoon();
      }
      return;
    }
    const id = el && el.dataset.srcId ? Number(el.dataset.srcId) : null;
    setHotSrc((p) => (p === id ? p : id));
  }
  function onCenterLeave() {
    if (compact) hideTipSoon();
    else setHotSrc(null);
  }

  if (error) return <div className="fatal">⚠ {error}</div>;
  if (!ready) return <div className="loading">Loading…</div>;

  const current = focusSlug ? bySlug.get(focusSlug) : sections[0];

  return (
    <div className="reader">
      <header className="reader__bar">
        <div className="brand">
          <Logo className="brand__mark" />
          <span className="brand__name">Linked Mark Down</span>
          <span className="brand__tag">{editing ? "editor" : "reader"}</span>
        </div>
        {editing ? (
          <div className="focusnow">
            Editing <span className="focustag">{FM.title}</span>
          </div>
        ) : (
          <div className="focusnow">
            {viewKey !== MAIN_KEY && <span className="focusdoc">{view.title} ↗</span>}
            Focused on <span className="focustag">{current?.title}</span>
          </div>
        )}
        <div className="modeswitch" role="group" aria-label="Layout">
          <button className={`modeswitch__btn${!compact ? " is-on" : ""}`} onClick={() => setCompact(false)}>
            Full
          </button>
          <button className={`modeswitch__btn${compact ? " is-on" : ""}`} onClick={() => setCompact(true)}>
            Compact
          </button>
        </div>
      </header>

      {editing ? (
        <EditorShell
          initial={body}
          anchors={sections.map((s) => ({ slug: s.slug, title: s.title }))}
          imports={IMPORTS}
          compact={compact}
          onSave={(b) => {
            setBody(b);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
      <main className={compact ? "cols cols--compact" : "cols cols--3"}>
        {!compact && <svg className="wires" ref={wiresRef} aria-hidden />}
        {!compact && (
          <section className="col col--prev">
            <div className="col__label">
              Previous
              {leftEntry && (
                <button className="editbtn" onClick={back} title="Back">
                  ← back
                </button>
              )}
            </div>
            {leftEntry && leftReg ? (
              <div className="doc-wrap">
                <div className="focusline focusline--sm" aria-hidden />
                <div className="doc doc--ghost" onClick={back} title="Go back">
                  <article className="doc__body" ref={prevRef} dangerouslySetInnerHTML={{ __html: leftHtml }} />
                </div>
                <div className="doc__badge">{leftReg.title} · ← back</div>
              </div>
            ) : (
              <div className="col__empty">No history yet — follow a link to build it.</div>
            )}
          </section>
        )}

        <section className="col col--current">
          <div className="col__label">
            {viewKey === MAIN_KEY ? "Document" : view.title}
            {compact && view.editable && leftEntry && (
              <button className="editbtn" onClick={back} title="Back">
                ← back
              </button>
            )}
            {view.editable ? (
              <button className="editbtn" onClick={() => setEditing(true)}>
                ✎ Edit
              </button>
            ) : (
              <button className="editbtn" onClick={back} title="Back to where you came from">
                ← back
              </button>
            )}
          </div>
          <div className="doc-wrap">
            <div className="focusline" aria-hidden />
            <div className="doc doc--current" ref={centerScroll}>
              <article
                className="doc__body"
                ref={centerRef}
                onClick={onCenterClick}
                onMouseOver={onCenterOver}
                onMouseLeave={onCenterLeave}
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
            </div>
          </div>
        </section>

        {!compact && (
          <section className="col col--links">
            <div className="col__label">Links near focus</div>
            <div className="cards-canvas" ref={canvasRef}>
              {linkCards.map((card) => (
                <button
                  key={card.id}
                  ref={(el) => cardRefs.current.set(card.id, el)}
                  className={`card lc-${card.color}${card.kind === "cross" ? " card--cross" : ""}${card.srcId === hotSrc ? " is-hot" : ""}`}
                  data-dir="mid"
                  style={{ display: "none" }}
                  onMouseEnter={() => setHotSrc(card.srcId)}
                  onMouseLeave={() => setHotSrc(null)}
                  onClick={() => {
                    if (card.kind === "cross") {
                      const doc = crossDocs.get(card.docUuid!) ?? workspace.findByUuid(card.docUuid!);
                      if (doc) gotoDoc(doc, card.slug);
                    } else {
                      goto(card.slug);
                    }
                  }}
                >
                  {card.kind === "cross" && (
                    <span className="card__ext">
                      ↗ {card.alias}:{card.slug}
                    </span>
                  )}
                  <span className="card__title">{card.title}</span>
                  <span className="card__preview">{card.preview}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
      )}

      {tip && !editing && (
        <div
          className="linktip"
          ref={tipBoxRef}
          style={{ left: 0, top: 0, visibility: "hidden" }}
          onMouseEnter={cancelHideTip}
          onMouseLeave={hideTipSoon}
        >
          {tip.cards.map((c, i) => (
            <button
              key={`${c.kind}:${c.slug}:${i}`}
              className={`linktip__card lc-${c.color}${c.kind === "cross" ? " card--cross" : ""}`}
              onClick={() => onCenterClickTip(c)}
            >
              {c.kind === "cross" && (
                <span className="card__ext">
                  ↗ {c.alias}:{c.slug}
                </span>
              )}
              <span className="card__title">{c.title}</span>
              <span className="card__preview">{c.preview}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

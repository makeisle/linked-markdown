/**
 * Render a Linked Markdown {@link Doc} to HTML and compute its link-graph
 * overlay. This module is pure (no DOM), so it runs and tests in Node; the
 * DOM-mounting helper lives in {@link ./mount}.
 *
 * The body is plain Markdown once the escape comments are accounted for, so we
 * render it with markdown-it. Before rendering we turn each `<!--lmd:a slug-->`
 * anchor into an invisible span carrying the slug, so the overlay can locate the
 * DOM node for every linkable block. Visible refs (Markdown links whose target
 * is an lmd address) are tagged with data attributes during rendering.
 */

import { parseAddress, type Doc, type Edge, type Node } from "@lmd/core";
import MarkdownIt from "markdown-it";

export interface Backlink {
  /** Source slug of the inbound edge. */
  from: string;
  rel: string;
}

export interface RenderResult {
  /** Rendered body HTML, with anchors and refs tagged for the overlay. */
  html: string;
  /** Inbound edges per target slug (local edges only). */
  backlinks: Record<string, Backlink[]>;
  /** All manifest nodes, keyed by slug (empty if the doc is unbuilt). */
  nodes: Record<string, Node>;
  /** All manifest edges (empty if the doc is unbuilt). */
  edges: Edge[];
}

const RE_ANCHOR = /<!--lmd:a\s+([a-z][a-z0-9-]*)(?:\s+rev=\d+)?\s*-->/g;
// A ref wraps its source text: <!--lmd:ref targets-->text<!--/lmd-->.
const RE_REF = /<!--lmd:ref\s+([\s\S]*?)\s*-->([\s\S]*?)<!--\s*\/lmd\s*-->/g;

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Replace lmd escape comments with overlay-friendly markup before rendering. */
function preprocess(body: string): string {
  return body
    .replace(
      RE_ANCHOR,
      (_m, slug: string) =>
        `<span class="lmd-anchor" id="lmd-${escapeAttr(slug)}" data-lmd-anchor="${escapeAttr(slug)}"></span>`,
    )
    // A ref becomes a styled link over its source text, carrying its raw
    // `[role=]target,…` list so the overlay can draw one connector per target.
    .replace(
      RE_REF,
      (_m, targets: string, text: string) =>
        `<span class="lmd-ref" data-lmd-targets="${escapeAttr(targets.trim())}">${text.trim()}</span>`,
    );
}

function makeMarkdown(): MarkdownIt {
  // `html: true` lets the injected anchor/ref markup pass through.
  return new MarkdownIt({ html: true, linkify: false });
}

/** Render a document and compute its overlay. */
export function renderToHtml(doc: Doc): RenderResult {
  const md = makeMarkdown();
  const html = md.render(preprocess(doc.body));

  const nodes = doc.manifest?.nodes ?? {};
  const edges = doc.manifest?.edges ?? [];

  const backlinks: Record<string, Backlink[]> = {};
  for (const edge of edges) {
    const addr = parseAddress(edge.to);
    if (addr.kind === "local") {
      (backlinks[addr.slug] ??= []).push({ from: edge.from, rel: edge.rel });
    }
  }

  return { html, backlinks, nodes, edges };
}

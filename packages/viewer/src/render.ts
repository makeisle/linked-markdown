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
const RE_REL = /<!--lmd:rel\s+(.*?)\s*-->/g;
const RE_REF = /<!--lmd:ref\b.*?-->/g;

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
    // An invisible relation marks its source position so an overlay can draw
    // connectors; keep the raw `role=target,…` pairs on a data attribute.
    .replace(
      RE_REL,
      (_m, inner: string) => `<span class="lmd-relsrc" data-lmd-rel="${escapeAttr(inner.trim())}"></span>`,
    )
    // A ref only annotates the visible link that precedes it; drop it.
    .replace(RE_REF, "");
}

function makeMarkdown(): MarkdownIt {
  const md = new MarkdownIt({ html: true, linkify: false });

  // Tag links whose target is an lmd address so the overlay can wire popovers.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href");
    if (href && parseAddress(href).kind !== "external") {
      tokens[idx].attrJoin("class", "lmd-ref");
      tokens[idx].attrSet("data-lmd-target", href);
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
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

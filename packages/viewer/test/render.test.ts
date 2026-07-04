import assert from "node:assert/strict";
import { test } from "node:test";
import type { Doc } from "@lmd/core";
import { renderToHtml } from "../src/render.js";

const doc: Doc = {
  frontmatter: { lmd: 1, id: "doc-1", version: 1, title: "Test" },
  body: [
    "## Authentication <!--lmd:a auth-->",
    "",
    "A member signs up; <!--lmd:ref impacts=:auth related=:auth-->this section<!--/lmd--> matters.",
    "",
    "A plain [markdown link](https://example.com) is not an lmd link.",
  ].join("\n"),
  manifest: {
    schema: 1,
    body_hash: "sha256:x",
    nodes: { auth: { uuid: "u-auth", kind: "heading", rev: 1, hash: "sha256:y" } },
    edges: [
      { from: "auth", rel: "impacts", to: ":auth", uuid: "u-auth" },
      { from: "auth", rel: "related", to: ":auth", uuid: "u-auth" },
    ],
    imports: {},
  },
};

test("anchors become locatable spans", () => {
  const { html } = renderToHtml(doc);
  assert.match(html, /id="lmd-auth"/);
  assert.match(html, /data-lmd-anchor="auth"/);
});

test("a ref wraps its source text and carries its targets", () => {
  const { html } = renderToHtml(doc);
  assert.match(html, /class="lmd-ref"[^>]*data-lmd-targets="impacts=:auth related=:auth"/);
  assert.match(html, /class="lmd-ref"[^>]*>this section<\/span>/);
  // A plain markdown link stays a plain anchor, not an lmd ref.
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /lmd-ref[^>]*example\.com/);
});

test("escape comments leave no visible residue", () => {
  const { html } = renderToHtml(doc);
  assert.doesNotMatch(html, /lmd:ref/);
  assert.doesNotMatch(html, /\/lmd--/);
});

test("backlinks are computed per target slug", () => {
  const { backlinks } = renderToHtml(doc);
  assert.equal(backlinks.auth.length, 2);
  assert.deepEqual(
    backlinks.auth.map((b) => b.rel).sort(),
    ["impacts", "related"],
  );
});

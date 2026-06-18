import assert from "node:assert/strict";
import { test } from "node:test";
import type { Doc } from "@lmd/core";
import { renderToHtml } from "../src/render.js";

const doc: Doc = {
  frontmatter: { lmd: 1, id: "doc-1", version: 1, title: "Test" },
  body: [
    "## Authentication <!--lmd:a auth-->",
    "",
    "A member signs up. See [the section](:auth)<!--lmd:ref rel=related-->.",
    "<!--lmd:rel impacts=:auth-->",
    "",
    "External [link](https://example.com) must not be tagged.",
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

test("lmd refs are tagged, external links are not", () => {
  const { html } = renderToHtml(doc);
  assert.match(html, /class="lmd-ref"[^>]*data-lmd-target=":auth"|data-lmd-target=":auth"/);
  // The external link is a plain anchor without the lmd-ref class.
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /lmd-ref[^>]*example\.com/);
});

test("escape comments leave no visible residue", () => {
  const { html } = renderToHtml(doc);
  assert.doesNotMatch(html, /lmd:rel/);
  assert.doesNotMatch(html, /lmd:ref/);
});

test("backlinks are computed per target slug", () => {
  const { backlinks } = renderToHtml(doc);
  assert.equal(backlinks.auth.length, 2);
  assert.deepEqual(
    backlinks.auth.map((b) => b.rel).sort(),
    ["impacts", "related"],
  );
});

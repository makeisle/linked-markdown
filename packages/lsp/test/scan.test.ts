import assert from "node:assert/strict";
import { test } from "node:test";
import { inRange, scan } from "../src/scan.js";

const DOC = [
  "---",
  "lmd: 1",
  "id: d",
  "version: 1",
  "title: T",
  "imports:",
  "  design: { id: 0192-design, pin: \"@7\" }",
  "  policy: { id: 0192-policy, pin: \"@2\" }",
  "---",
  "",
  "## Authentication <!--lmd:a auth-->",
  "",
  "See [the section](:auth) and [a use case](design:uc-join).",
  "<!--lmd:rel impacts=design:uc-join-->",
].join("\n");

test("scan finds anchors with ranges", () => {
  const r = scan(DOC);
  assert.equal(r.anchors.length, 1);
  assert.equal(r.anchors[0].slug, "auth");
  assert.equal(r.anchors[0].range.start.line, 10);
});

test("scan finds import namespaces", () => {
  const r = scan(DOC);
  assert.deepEqual(r.imports.sort(), ["design", "policy"]);
});

test("scan finds lmd edges (local + cross + rel), skips external", () => {
  const r = scan(DOC);
  const targets = r.edges.map((e) => e.target).sort();
  // :auth, design:uc-join (link), design:uc-join (rel)
  assert.ok(targets.includes(":auth"));
  assert.equal(targets.filter((t) => t === "design:uc-join").length, 2);
});

test("inRange locates the edge under a cursor", () => {
  const r = scan(DOC);
  const edge = r.edges.find((e) => e.target === ":auth")!;
  const mid = { line: edge.range.start.line, character: edge.range.start.character + 1 };
  assert.ok(inRange(edge.range, mid));
  assert.ok(!inRange(edge.range, { line: edge.range.start.line, character: 0 }));
});

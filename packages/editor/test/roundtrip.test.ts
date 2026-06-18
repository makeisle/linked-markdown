import assert from "node:assert/strict";
import { test } from "node:test";
import { lmdSchema } from "../src/schema.js";
import { parseLmdBody, serializeLmdBody } from "../src/markdown.js";

const BODY = [
  "## Authentication <!--lmd:a auth-->",
  "",
  "A member signs up. See [the policy](policy:perf@2)<!--lmd:ref rel=policy-->.",
  "",
  "<!--lmd:rel impacts=:uc-join,:uc-approve-->",
  "",
  "- First item <!--lmd:a item-one-->",
  "- Second item",
].join("\n");

test("schema has the lmd atom nodes", () => {
  assert.ok(lmdSchema.nodes.lmd_comment, "lmd_comment node exists");
  assert.ok(lmdSchema.nodes.lmd_block_comment, "lmd_block_comment node exists");
});

test("body → ProseMirror → body is idempotent", () => {
  const once = serializeLmdBody(parseLmdBody(BODY));
  const twice = serializeLmdBody(parseLmdBody(once));
  assert.equal(once, twice, "round-trip must reach a fixed point");
});

test("every escape comment and lmd address survives the round-trip", () => {
  const out = serializeLmdBody(parseLmdBody(BODY));
  for (const fragment of [
    "<!--lmd:a auth-->",
    "<!--lmd:ref rel=policy-->",
    "<!--lmd:rel impacts=:uc-join,:uc-approve-->",
    "<!--lmd:a item-one-->",
    "policy:perf@2",
  ]) {
    assert.ok(out.includes(fragment), `expected output to preserve: ${fragment}`);
  }
});

test("anchors are parsed as inline atoms on their block", () => {
  const doc = parseLmdBody("## Title <!--lmd:a slug-->");
  const heading = doc.firstChild!;
  assert.equal(heading.type.name, "heading");
  const last = heading.lastChild!;
  assert.equal(last.type.name, "lmd_comment");
  assert.equal(last.attrs.raw, "<!--lmd:a slug-->");
});

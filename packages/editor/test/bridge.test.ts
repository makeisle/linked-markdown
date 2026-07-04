import assert from "node:assert/strict";
import { test } from "node:test";
import { markdownToTiptap, tiptapToMarkdown } from "../src/bridge.js";

const BODY = [
  "## Authentication <!--lmd:a auth-->",
  "",
  "A member signs up under <!--lmd:ref policy=policy:perf@2 impacts=:uc-join-->the policy<!--/lmd-->.",
  "",
  "- First item <!--lmd:a item-one-->",
  "- Second item",
].join("\n");

function findTypes(json: unknown, acc = new Set<string>()): Set<string> {
  const n = json as { type?: string; content?: unknown[] };
  if (n.type) acc.add(n.type);
  if (Array.isArray(n.content)) for (const c of n.content) findTypes(c, acc);
  return acc;
}

test("markdownToTiptap uses TipTap (camelCase) node names", () => {
  const json = markdownToTiptap(BODY);
  const types = findTypes(json);
  assert.ok(types.has("bulletList"), "expected bulletList");
  assert.ok(types.has("listItem"), "expected listItem");
  assert.ok(types.has("lmd_comment"), "lmd atoms keep their name");
});

test("markdown → TipTap → markdown is idempotent", () => {
  const once = tiptapToMarkdown(markdownToTiptap(BODY));
  const twice = tiptapToMarkdown(markdownToTiptap(once));
  assert.equal(once, twice);
});

test("escape comments and addresses survive the TipTap bridge", () => {
  const out = tiptapToMarkdown(markdownToTiptap(BODY));
  for (const fragment of [
    "<!--lmd:a auth-->",
    "<!--lmd:ref policy=policy:perf@2 impacts=:uc-join-->",
    "<!--/lmd-->",
    "<!--lmd:a item-one-->",
    "policy:perf@2",
  ]) {
    assert.ok(out.includes(fragment), `expected: ${fragment}`);
  }
});

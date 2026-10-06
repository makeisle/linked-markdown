import assert from "node:assert/strict";
import { test } from "node:test";
import { aliasFrom } from "../src/EditorShell.js";

test("aliasFrom - title with spaces and capitals - lowercase hyphenated", () => {
  assert.equal(aliasFrom("Compiler Architecture", new Set()), "compiler-architecture");
});

test("aliasFrom - punctuation and edges - collapsed and trimmed", () => {
  assert.equal(aliasFrom("  --Security (v2)!  ", new Set()), "security-v2");
});

test("aliasFrom - nothing alphanumeric - falls back to doc", () => {
  assert.equal(aliasFrom("한글 ###", new Set()), "doc");
  assert.equal(aliasFrom("", new Set()), "doc");
});

test("aliasFrom - taken alias - appends -2 then -3", () => {
  assert.equal(aliasFrom("Glossary", new Set(["glossary"])), "glossary-2");
  assert.equal(aliasFrom("Glossary", new Set(["glossary", "glossary-2"])), "glossary-3");
});

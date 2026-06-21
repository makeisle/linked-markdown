import assert from "node:assert/strict";
import { test } from "node:test";
import { describeComment } from "../src/chip.js";

test("anchor label is the slug without the closing dashes", () => {
  // Regression: the regex must stop at `-->`, not eat into it.
  assert.deepEqual(describeComment("<!--lmd:a intro-->"), { icon: "⚓", label: "intro", kind: "anchor" });
  assert.equal(describeComment("<!--lmd:a cap-auth rev=2-->").label, "cap-auth");
});

test("ref and rel labels", () => {
  assert.equal(describeComment("<!--lmd:ref rel=policy-->").kind, "ref");
  assert.equal(describeComment("<!--lmd:ref rel=policy-->").label, "policy");
  assert.equal(describeComment("<!--lmd:rel impacts=:a,:b parent=:c-->").label, "impacts · parent");
});

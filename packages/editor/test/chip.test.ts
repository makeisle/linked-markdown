import assert from "node:assert/strict";
import { test } from "node:test";
import { describeComment } from "../src/chip.js";

test("anchor label is the slug without the closing dashes", () => {
  // Regression: the regex must stop at `-->`, not eat into it.
  assert.deepEqual(describeComment("<!--lmd:a intro-->"), { icon: "⚓", label: "intro", kind: "anchor" });
  assert.equal(describeComment("<!--lmd:a cap-auth rev=2-->").label, "cap-auth");
});

test("ref labels show roles, or a target count when untyped", () => {
  assert.equal(describeComment("<!--lmd:ref policy=:perf-->").kind, "ref");
  assert.equal(describeComment("<!--lmd:ref impacts=:a,:b parent=:c-->").label, "impacts · parent");
  assert.equal(describeComment("<!--lmd:ref :a,:b-->").label, "2 targets");
});

test("the ref close is its own chip", () => {
  assert.equal(describeComment("<!--/lmd-->").kind, "close");
});

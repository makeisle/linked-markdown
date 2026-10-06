import assert from "node:assert/strict";
import { test } from "node:test";
import type { Resolution, Workspace, WsDoc } from "../src/workspace.js";

// A test-only implementation of the Workspace contract (the package ships none).
// Mirrors the playground's in-memory workspace: policy moved to policy/v2/.
const doc = (uuid: string, title: string): WsDoc => ({ uuid, title, body: `# ${title}`, anchors: [] });
const DESIGN = doc("uuid-design", "Compiler architecture");
const POLICY = doc("uuid-policy", "Security policy");
const FS = new Map<string, string>([
  ["design/architecture.lmd", DESIGN.uuid],
  ["policy/v2/security.lmd", POLICY.uuid],
]);
const DOCS = new Map<string, WsDoc>([
  [DESIGN.uuid, DESIGN],
  [POLICY.uuid, POLICY],
]);

function fakeWorkspace(): Workspace {
  const ws: Workspace = {
    resolveByPath: (path) => DOCS.get(FS.get(path) ?? "") ?? null,
    findByUuid: (id) => DOCS.get(id) ?? null,
    pathOf(id) {
      for (const [p, u] of FS) if (u === id) return p;
      return null;
    },
    resolve(id, path): Resolution {
      const d = DOCS.get(id);
      if (d && FS.get(path) === id) return { status: "found", doc: d, path };
      const now = ws.pathOf(id);
      if (d && now) return { status: "moved", doc: d, from: path, to: now };
      return { status: "missing" };
    },
    addDoc: (path) => ws.resolveByPath(path),
    browsable: () => [...FS].map(([path, id]) => ({ path, title: DOCS.get(id)?.title ?? path })),
  };
  return ws;
}

test("Workspace - declared path holds the doc - found", () => {
  const r = fakeWorkspace().resolve(DESIGN.uuid, "design/architecture.lmd");
  assert.deepEqual(r, { status: "found", doc: DESIGN, path: "design/architecture.lmd" });
});

test("Workspace - stale path but uuid lives elsewhere - moved with new path", () => {
  const r = fakeWorkspace().resolve(POLICY.uuid, "policy/security.lmd");
  assert.deepEqual(r, { status: "moved", doc: POLICY, from: "policy/security.lmd", to: "policy/v2/security.lmd" });
});

test("Workspace - uuid nowhere - missing", () => {
  assert.deepEqual(fakeWorkspace().resolve("uuid-gone", "x.lmd"), { status: "missing" });
});

test("Workspace - lookups - null for unknown path/uuid, browsable lists all", () => {
  const ws = fakeWorkspace();
  assert.equal(ws.resolveByPath("nope.lmd"), null);
  assert.equal(ws.findByUuid("nope"), null);
  assert.equal(ws.pathOf("nope"), null);
  assert.equal(ws.addDoc("design/architecture.lmd"), DESIGN);
  assert.equal(ws.browsable().length, 2);
});

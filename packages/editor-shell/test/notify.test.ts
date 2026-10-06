import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { JSDOM } from "jsdom";
import type * as core from "@lmd/core";
import type { Resolution, Workspace, WsDoc } from "../src/workspace.js";

// jsdom must exist before React Testing Library is loaded.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
for (const k of ["window", "document", "navigator", "HTMLElement", "HTMLTextAreaElement", "Node", "getComputedStyle", "MutationObserver"]) {
  Object.defineProperty(g, k, { value: (dom.window as unknown as Record<string, unknown>)[k], configurable: true, writable: true });
}
g.requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
g.IS_REACT_ACT_ENVIRONMENT = true;

type Rtl = typeof import("@testing-library/react");
type Shell = typeof import("../src/EditorShell.js");
let rtl: Rtl;
let EditorShell: Shell["EditorShell"];
let React: typeof import("react");

before(async () => {
  React = await import("react");
  rtl = await import("@testing-library/react");
  EditorShell = (await import("../src/EditorShell.js")).EditorShell;
});
afterEach(() => rtl.cleanup());

const mk = (uuid: string, title: string): WsDoc => ({ uuid, title, body: `# ${title}`, anchors: [{ slug: "intro", title: "Intro" }] });
const DESIGN = mk("uuid-design", "Compiler architecture");
const POLICY = mk("uuid-policy", "Security policy");
const FS = new Map([
  ["design/v2/architecture.lmd", DESIGN.uuid],
  ["policy/security.lmd", POLICY.uuid],
]);
const DOCS = new Map([
  [DESIGN.uuid, DESIGN],
  [POLICY.uuid, POLICY],
]);
function workspaceFixture(): Workspace {
  const ws: Workspace = {
    resolveByPath: (p) => DOCS.get(FS.get(p) ?? "") ?? null,
    findByUuid: (id) => DOCS.get(id) ?? null,
    pathOf: (id) => [...FS].find(([, u]) => u === id)?.[0] ?? null,
    resolve(id, path): Resolution {
      const d = DOCS.get(id);
      if (d && FS.get(path) === id) return { status: "found", doc: d, path };
      const now = ws.pathOf(id);
      if (d && now) return { status: "moved", doc: d, from: path, to: now };
      return { status: "missing" };
    },
    addDoc: (p) => ws.resolveByPath(p),
    browsable: () => [...FS].map(([path, id]) => ({ path, title: DOCS.get(id)?.title ?? path })),
  };
  return ws;
}
const importsFixture = (): Record<string, core.Import> => ({
  design: { id: DESIGN.uuid, path: "design/architecture.lmd" }, // moved
  gone: { id: "uuid-gone", path: "old/gone.lmd" }, // missing
});

interface Calls {
  bodies: string[];
  imports: Array<Record<string, core.Import>>;
}
function renderShell(extra: Record<string, unknown> = {}): Calls {
  const calls: Calls = { bodies: [], imports: [] };
  rtl.render(
    React.createElement(EditorShell, {
      workspace: workspaceFixture(),
      initial: "# Title",
      anchors: [{ slug: "intro", title: "Intro" }],
      imports: importsFixture(),
      onSave: () => {},
      onCancel: () => {},
      ...extra,
    } as never),
  );
  return calls;
}
function renderWith(): Calls {
  const calls: Calls = { bodies: [], imports: [] };
  rtl.render(
    React.createElement(EditorShell, {
      workspace: workspaceFixture(),
      initial: "# Title",
      anchors: [{ slug: "intro", title: "Intro" }],
      imports: importsFixture(),
      onSave: () => {},
      onCancel: () => {},
      onChange: (b: string) => calls.bodies.push(b),
      onImportsChange: (i: Record<string, core.Import>) => calls.imports.push(i),
    }),
  );
  return calls;
}
const click = (name: RegExp | string) => rtl.fireEvent.click(rtl.screen.getByRole("button", { name }));

test("EditorShell - body edited - onChange gets the new body", () => {
  const calls = renderWith();
  rtl.fireEvent.change(rtl.screen.getByRole("textbox"), { target: { value: "# Title\nmore" } });
  assert.deepEqual(calls.bodies, ["# Title\nmore"]);
  assert.deepEqual(calls.imports, []);
});

test("EditorShell - Relink - onImportsChange has the moved path", () => {
  const calls = renderWith();
  click("Relink");
  assert.equal(calls.imports.length, 1, JSON.stringify(calls.imports));
  assert.deepEqual(calls.imports[0], {
    design: { id: DESIGN.uuid, path: "design/v2/architecture.lmd" },
    gone: { id: "uuid-gone", path: "old/gone.lmd" },
  });
});

test("EditorShell - Delete links then Keep - import removed then restored", () => {
  const calls = renderWith();
  click("Delete links");
  assert.deepEqual(Object.keys(calls.imports[0]), ["design"]);
  click("Undo");
  assert.deepEqual(Object.keys(calls.imports[1]), ["design", "gone"]);
  assert.equal(calls.imports.length, 2);
});

test("EditorShell - plus adds a document - onImportsChange includes the new alias", () => {
  const calls = renderWith();
  rtl.fireEvent.click(rtl.screen.getByTitle("Add a reference document"));
  click(/Security policy/);
  assert.equal(calls.imports.length, 1);
  assert.deepEqual(calls.imports[0]["security-policy"], { id: POLICY.uuid, path: "policy/security.lmd" });
  assert.equal(Object.keys(calls.imports[0]).length, 3);
});

test("EditorShell - hideActions - no Save or Cancel button", () => {
  renderShell({ hideActions: true });
  assert.equal(rtl.screen.queryByRole("button", { name: "Save" }), null);
  assert.equal(rtl.screen.queryByRole("button", { name: "Cancel" }), null);
});

test("EditorShell - no new props - Save/Cancel work as before", () => {
  const saved: string[] = [];
  renderShell({ onSave: (m: string) => saved.push(m) });
  rtl.fireEvent.change(rtl.screen.getByRole("textbox"), { target: { value: "edited" } });
  click("Cancel");
  click("Save");
  assert.deepEqual(saved, ["edited"]);
  click("Relink"); // no handler supplied: must not throw
});

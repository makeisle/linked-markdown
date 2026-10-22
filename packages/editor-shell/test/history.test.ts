import assert from "node:assert/strict";
import { afterEach, before, mock, test } from "node:test";
import { JSDOM } from "jsdom";
import type * as core from "@lmd/core";
import {
  DEFAULT_HISTORY_LIMITS,
  canRedo,
  canUndo,
  createHistory,
  parseHistory,
  recordEdit,
  redo,
  undo,
  type EditHistory,
} from "../src/history.js";
import type { Resolution, Workspace } from "../src/workspace.js";

// ───────────────────────── pure history ─────────────────────────

const snap = (text: string, at = text.length) => ({ text, start: at, end: at });
const LIMITS = DEFAULT_HISTORY_LIMITS;
const GAP = LIMITS.groupMs + 1; // idle long enough to close a typing group

/** Type `text` one character at a time, `stepMs` apart, starting at `t0`. */
function typeChars(h: EditHistory, text: string, t0: number, stepMs: number): EditHistory {
  let cur = h;
  let acc = cur.present.text;
  let t = t0;
  for (const ch of text) {
    acc += ch;
    cur = recordEdit(cur, snap(acc), t);
    t += stepMs;
  }
  return cur;
}

test("history - fresh - nothing to undo or redo", () => {
  const h = createHistory("abc");
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), false);
  assert.equal(undo(h), null);
  assert.equal(redo(h), null);
  assert.deepEqual(h.present, { text: "abc", start: 0, end: 0 });
});

test("history - one edit then undo then redo - walks the snapshots with selection", () => {
  let h = createHistory("abc", { start: 3, end: 3 });
  h = recordEdit(h, { text: "abcd", start: 4, end: 4 }, 1000);
  const back = undo(h);
  assert.ok(back);
  assert.deepEqual(back.present, { text: "abc", start: 3, end: 3 });
  assert.equal(canRedo(back), true);
  const fwd = redo(back);
  assert.ok(fwd);
  assert.deepEqual(fwd.present, { text: "abcd", start: 4, end: 4 });
  assert.equal(canRedo(fwd), false);
});

test("history - quick typing - merged into one undo unit", () => {
  const h = typeChars(createHistory(""), "hello", 1000, 100);
  assert.equal(h.present.text, "hello");
  assert.equal(h.past.length, 1, JSON.stringify(h));
  const back = undo(h);
  assert.equal(back?.present.text, "");
});

test("history - idle gap while typing - splits into two units", () => {
  let h = typeChars(createHistory(""), "ab", 1000, 100);
  h = typeChars(h, "cd", 1100 + GAP, 100);
  assert.equal(h.present.text, "abcd");
  assert.equal(undo(h)?.present.text, "ab");
  assert.equal(undo(undo(h) as EditHistory)?.present.text, "");
});

test("history - a large change (paste) - never merges into typing", () => {
  let h = typeChars(createHistory(""), "ab", 1000, 100);
  h = recordEdit(h, snap("abPASTED"), 1200);
  h = recordEdit(h, snap("abPASTEDx"), 1300);
  assert.equal(undo(h)?.present.text, "abPASTED");
  assert.equal(undo(undo(h) as EditHistory)?.present.text, "ab");
});

test("history - newUnit - starts a fresh unit even inside the time window", () => {
  let h = recordEdit(createHistory(""), snap("a"), 1000);
  h = recordEdit(h, snap("ab"), 1050, { newUnit: true });
  assert.equal(undo(h)?.present.text, "a");
});

test("history - closeGroup - the next quick edit starts a new unit", () => {
  let h = recordEdit(createHistory(""), snap("a"), 1000, { newUnit: true, closeGroup: true });
  h = recordEdit(h, snap("ab"), 1050);
  assert.equal(undo(h)?.present.text, "a");
});

test("history - new edit after undo - redo branch is dropped", () => {
  let h = recordEdit(createHistory("a"), snap("ab"), 1000);
  h = undo(h) as EditHistory;
  assert.equal(canRedo(h), true);
  h = recordEdit(h, snap("ax"), 5000);
  assert.equal(canRedo(h), false);
  assert.equal(h.present.text, "ax");
});

test("history - same text recorded again - unchanged (same object)", () => {
  const h = recordEdit(createHistory("a"), snap("ab"), 1000);
  assert.equal(recordEdit(h, snap("ab", 0), 1100), h);
});

test("history - entry cap - oldest units are dropped, newest kept", () => {
  const limits = { ...LIMITS, maxEntries: 3 };
  let h = createHistory("");
  let text = "";
  for (let i = 0; i < 10; i++) {
    text += "xy"; // 2 chars each: never typing-like, so every edit is its own unit
    h = recordEdit(h, snap(text), 1000 + i, {}, limits);
  }
  assert.equal(h.past.length, 3);
  assert.equal(h.present.text.length, 20);
  assert.equal(h.past[2].text.length, 18);
});

test("history - char budget - drops oldest units but keeps at least one", () => {
  const limits = { ...LIMITS, maxChars: 10 };
  let h = createHistory("");
  for (const t of ["12345678", "1234567890123456", "12345678901234567890"]) {
    h = recordEdit(h, snap(t), 1000, { newUnit: true }, limits);
  }
  assert.ok(h.past.length >= 1);
  assert.ok(h.past.length < 3, `past=${h.past.length}`);
  assert.equal(h.present.text, "12345678901234567890");
});

test("history - JSON roundtrip - parse gives an equal, usable history", () => {
  let h = typeChars(createHistory("seed"), "abc", 1000, 100);
  h = recordEdit(h, snap("seedabcXXXX"), 9000);
  h = undo(h) as EditHistory;
  const copy = parseHistory(JSON.parse(JSON.stringify(h)));
  assert.deepEqual(copy, h);
  assert.equal(undo(copy as EditHistory)?.present.text, "seed");
});

test("history - parse - rejects malformed input", () => {
  assert.equal(parseHistory(null), null);
  assert.equal(parseHistory("x"), null);
  assert.equal(parseHistory({}), null);
  assert.equal(parseHistory({ version: 1, past: [{ text: 1 }], present: snap("a"), future: [] }), null);
  assert.equal(parseHistory({ ...createHistory("a"), version: 2 }), null);
});

test("history - selection beyond the text - clamped into range", () => {
  const h = recordEdit(createHistory("ab"), { text: "abc", start: 99, end: -4 }, 1000);
  assert.deepEqual(h.present, { text: "abc", start: 3, end: 0 });
});

// ───────────────────────── EditorShell wiring ─────────────────────────

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
afterEach(() => {
  rtl.cleanup();
  mock.timers.reset();
});

const workspaceFixture = (): Workspace => ({
  resolveByPath: () => null,
  findByUuid: () => null,
  pathOf: () => null,
  resolve: (): Resolution => ({ status: "missing" }),
  addDoc: () => null,
  browsable: () => [],
});

interface Harness {
  ta: HTMLTextAreaElement;
  bodies: string[];
  histories: EditHistory[];
}
function renderShell(extra: Record<string, unknown> = {}, initial = "start"): Harness {
  const bodies: string[] = [];
  const histories: EditHistory[] = [];
  rtl.render(
    React.createElement(EditorShell, {
      workspace: workspaceFixture(),
      initial,
      anchors: [],
      imports: {} as Record<string, core.Import>,
      onSave: () => {},
      onCancel: () => {},
      onChange: (b: string) => bodies.push(b),
      ...extra,
    } as never),
  );
  const ta = rtl.screen.getByRole("textbox") as HTMLTextAreaElement;
  return { ta, bodies, histories };
}
const typeText = (ta: HTMLTextAreaElement, value: string) => {
  rtl.fireEvent.change(ta, { target: { value } });
};
const key = (ta: HTMLTextAreaElement, init: Record<string, unknown>) => rtl.fireEvent.keyDown(ta, init);
const ctrlZ = { key: "z", ctrlKey: true };
/** Move the (mocked) clock so the next edit starts a new unit. */
const idle = () => mock.timers.tick(GAP);

test("EditorShell history - Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z - undo and redo the body", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const { ta, bodies } = renderShell();
  typeText(ta, "start one two");
  idle();
  typeText(ta, "start one two three four");
  key(ta, ctrlZ);
  assert.equal(ta.value, "start one two");
  key(ta, ctrlZ);
  assert.equal(ta.value, "start");
  key(ta, { key: "y", ctrlKey: true });
  assert.equal(ta.value, "start one two");
  key(ta, { key: "Z", ctrlKey: true, shiftKey: true });
  assert.equal(ta.value, "start one two three four");
  assert.equal(bodies.at(-1), "start one two three four", JSON.stringify(bodies));
});

test("EditorShell history - the undone selection is restored", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const { ta } = renderShell({}, "abcdef");
  typeText(ta, "abcdefXYZ");
  idle();
  typeText(ta, "abcdefXYZ and more");
  key(ta, ctrlZ);
  assert.equal(ta.value, "abcdefXYZ");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [9, 9], "caret is where it was after that edit");
  key(ta, { key: "y", ctrlKey: true });
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [18, 18]);
});

test("EditorShell history - beforeinput historyUndo / historyRedo - handled and default prevented", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const { ta } = renderShell();
  typeText(ta, "start more words");
  const fire = (inputType: string) => {
    const ev = new dom.window.Event("beforeinput", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "inputType", { value: inputType });
    rtl.act(() => {
      ta.dispatchEvent(ev);
    });
    return ev;
  };
  assert.equal(fire("historyUndo").defaultPrevented, true);
  assert.equal(ta.value, "start");
  assert.equal(fire("historyRedo").defaultPrevented, true);
  assert.equal(ta.value, "start more words");
  assert.equal(fire("insertText").defaultPrevented, false);
});

test("EditorShell history - Korean composition - only the finished result is one unit", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const { ta } = renderShell({}, "");
  rtl.fireEvent.compositionStart(ta, { data: "" });
  for (const partial of ["ㅎ", "하", "한", "한ㄱ", "한글"]) {
    typeText(ta, partial);
    rtl.fireEvent.compositionUpdate(ta, { data: partial });
    // Ctrl+Z mid-composition belongs to the IME: it must not touch the text.
    key(ta, { ...ctrlZ, isComposing: true });
    assert.equal(ta.value, partial);
  }
  rtl.fireEvent.compositionEnd(ta, { data: "한글" });
  typeText(ta, "한글!"); // quick typing right after must not swallow the composition unit
  key(ta, ctrlZ);
  assert.equal(ta.value, "한글", "typing after composition is its own unit");
  key(ta, ctrlZ);
  assert.equal(ta.value, "", "the whole composition result undoes at once, no per-jamo steps");
});

test("EditorShell history - composition records nothing until it ends", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const seen: EditHistory[] = [];
  const { ta } = renderShell({ onHistoryChange: (h: EditHistory) => seen.push(h) }, "");
  rtl.fireEvent.compositionStart(ta, { data: "" });
  typeText(ta, "ㅇ");
  typeText(ta, "아");
  assert.equal(seen.length, 0, "no history change while composing");
  rtl.fireEvent.compositionEnd(ta, { data: "아" });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].present.text, "아");
  assert.equal(seen[0].past.length, 1);
});

test("EditorShell history - take out, unmount, remount with it - Ctrl+Z still goes back", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  let kept: EditHistory | null = null;
  const first = renderShell({ onHistoryChange: (h: EditHistory) => (kept = h) });
  typeText(first.ta, "start one two");
  idle();
  typeText(first.ta, "start one two three four");
  rtl.cleanup();
  assert.ok(kept);
  const stored = JSON.parse(JSON.stringify(kept)) as unknown; // survives a plain-data trip
  const second = renderShell({ history: stored }, "start one two three four");
  key(second.ta, ctrlZ);
  assert.equal(second.ta.value, "start one two");
  key(second.ta, ctrlZ);
  assert.equal(second.ta.value, "start");
  key(second.ta, { key: "y", ctrlKey: true });
  assert.equal(second.ta.value, "start one two");
});

test("EditorShell history - onHistoryChange - fires on edit, undo and redo", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const seen: EditHistory[] = [];
  const { ta } = renderShell({ onHistoryChange: (h: EditHistory) => seen.push(h) });
  typeText(ta, "start more words");
  assert.equal(seen.length, 1);
  key(ta, ctrlZ);
  assert.equal(seen.length, 2);
  assert.equal(seen[1].present.text, "start");
  key(ta, { key: "y", ctrlKey: true });
  assert.equal(seen.length, 3);
  assert.equal(seen[2].present.text, "start more words");
});

test("EditorShell history - nothing to undo - Ctrl+Z is a harmless no-op", () => {
  const { ta, bodies } = renderShell();
  key(ta, ctrlZ);
  assert.equal(ta.value, "start");
  assert.deepEqual(bodies, []);
});

test("EditorShell history - invalid history prop - ignored, editor still works", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const { ta } = renderShell({ history: { nonsense: true } });
  typeText(ta, "start more words");
  key(ta, ctrlZ);
  assert.equal(ta.value, "start");
});

test("EditorShell history - text changed behind its back - undo first records it, then goes back", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const stale = createHistory("older text");
  const { ta } = renderShell({ history: stale }, "start");
  key(ta, ctrlZ);
  assert.equal(ta.value, "older text");
  key(ta, { key: "y", ctrlKey: true });
  assert.equal(ta.value, "start");
});

test("EditorShell history - without the new props - body edits, Save and import table behave as before", () => {
  const saved: string[] = [];
  const { ta, bodies } = renderShell({ onSave: (m: string) => saved.push(m) });
  typeText(ta, "edited");
  assert.deepEqual(bodies, ["edited"]);
  rtl.fireEvent.click(rtl.screen.getByRole("button", { name: "Save" }));
  assert.deepEqual(saved, ["edited"]);
  // Other shortcuts and other fields are left alone.
  const ev = rtl.fireEvent.keyDown(ta, { key: "a", ctrlKey: true });
  assert.equal(ev, true, "Ctrl+A is not intercepted");
  rtl.fireEvent.click(rtl.screen.getByTitle("Add a reference document"));
  const pathInput = rtl.screen.getByPlaceholderText(/reference\/glossary/);
  const notPrevented = rtl.fireEvent.keyDown(pathInput, ctrlZ);
  assert.equal(notPrevented, true, "Ctrl+Z in the import path box keeps its native behaviour");
});

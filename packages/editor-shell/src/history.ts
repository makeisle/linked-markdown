/**
 * Undo / redo history for the `.lmd` body editor.
 *
 * Everything here is a pure function over plain, JSON-safe data, so a history
 * can be taken out of an editor, stored (even serialized), and handed back to a
 * new editor later. The browser's own undo stack lives inside the <textarea>
 * and is lost when the editor goes away; this one is not.
 */

/** The body text plus the selection at one moment. */
export interface HistorySnapshot {
  text: string;
  /** Selection start (UTF-16 offset), clamped into the text. */
  start: number;
  /** Selection end (UTF-16 offset), clamped into the text. */
  end: number;
}

export interface EditHistory {
  version: 1;
  /** Earlier states, oldest first. Does not include `present`. */
  past: HistorySnapshot[];
  /** The state the editor is showing now. */
  present: HistorySnapshot;
  /** States undone and available to redo, nearest first. */
  future: HistorySnapshot[];
  /** Time (ms) of the last recorded edit; 0 means "no open typing group". */
  lastAt: number;
  /** Whether the last recorded edit looked like plain typing (may be merged into). */
  typing: boolean;
}

export interface HistoryLimits {
  /** Typing that continues within this idle gap (ms) joins the same undo unit. */
  groupMs: number;
  /** Most undo units kept. */
  maxEntries: number;
  /** Most characters kept across all undo units (the newest unit is always kept). */
  maxChars: number;
}

export const DEFAULT_HISTORY_LIMITS: HistoryLimits = {
  groupMs: 1000,
  maxEntries: 200,
  maxChars: 2_000_000,
};

export interface RecordOptions {
  /** Always start a new undo unit (never merge into the previous one). */
  newUnit?: boolean;
  /** After recording, close the typing group so the next edit starts a new unit. */
  closeGroup?: boolean;
}

function clamp(n: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(n) ? Math.trunc(n) : 0, 0), max);
}

function normalize(s: HistorySnapshot): HistorySnapshot {
  return { text: s.text, start: clamp(s.start, s.text.length), end: clamp(s.end, s.text.length) };
}

/** A fresh history whose only state is `text`. */
export function createHistory(text: string, selection: { start: number; end: number } = { start: 0, end: 0 }): EditHistory {
  return {
    version: 1,
    past: [],
    present: normalize({ text, ...selection }),
    future: [],
    lastAt: 0,
    typing: false,
  };
}

export const canUndo = (h: EditHistory): boolean => h.past.length > 0;
export const canRedo = (h: EditHistory): boolean => h.future.length > 0;

/** Plain typing: one character in or out, with a caret rather than a selection. */
function isTypingLike(prev: HistorySnapshot, next: HistorySnapshot): boolean {
  return Math.abs(next.text.length - prev.text.length) <= 1 && next.start === next.end;
}

function trim(past: HistorySnapshot[], limits: HistoryLimits): HistorySnapshot[] {
  let from = Math.max(0, past.length - limits.maxEntries);
  let chars = 0;
  for (let i = from; i < past.length; i++) chars += past[i].text.length;
  while (from < past.length - 1 && chars > limits.maxChars) chars -= past[from++].text.length;
  return from === 0 ? past : past.slice(from);
}

/**
 * Record that the editor now shows `next`. Returns `h` itself when the text did
 * not change. Quick, consecutive single-character edits share one undo unit.
 */
export function recordEdit(
  h: EditHistory,
  next: HistorySnapshot,
  now: number,
  opts: RecordOptions = {},
  limits: HistoryLimits = DEFAULT_HISTORY_LIMITS,
): EditHistory {
  const snap = normalize(next);
  if (snap.text === h.present.text) return h;
  const typing = !opts.newUnit && isTypingLike(h.present, snap);
  const merge = typing && h.typing && h.lastAt > 0 && now - h.lastAt <= limits.groupMs;
  const past = merge ? h.past : trim([...h.past, h.present], limits);
  return {
    version: 1,
    past,
    present: snap,
    future: [],
    lastAt: opts.closeGroup ? 0 : now,
    typing: typing && !opts.closeGroup,
  };
}

/** Step back one unit, or `null` if there is nothing to undo. */
export function undo(h: EditHistory): EditHistory | null {
  const previous = h.past.at(-1);
  if (!previous) return null;
  return {
    version: 1,
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
    lastAt: 0,
    typing: false,
  };
}

/** Step forward one unit, or `null` if there is nothing to redo. */
export function redo(h: EditHistory): EditHistory | null {
  const [following, ...rest] = h.future;
  if (!following) return null;
  return {
    version: 1,
    past: trim([...h.past, h.present], DEFAULT_HISTORY_LIMITS),
    present: following,
    future: rest,
    lastAt: 0,
    typing: false,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSnapshot(v: unknown): HistorySnapshot | null {
  if (!isRecord(v) || typeof v.text !== "string" || typeof v.start !== "number" || typeof v.end !== "number") return null;
  return normalize({ text: v.text, start: v.start, end: v.end });
}

function parseSnapshots(v: unknown): HistorySnapshot[] | null {
  if (!Array.isArray(v)) return null;
  const out: HistorySnapshot[] = [];
  for (const item of v) {
    const s = parseSnapshot(item);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

/** Validate untrusted data (e.g. read back from storage); `null` if it is not a history. */
export function parseHistory(value: unknown): EditHistory | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const past = parseSnapshots(value.past);
  const future = parseSnapshots(value.future);
  const present = parseSnapshot(value.present);
  if (!past || !future || !present) return null;
  const lastAt = typeof value.lastAt === "number" && Number.isFinite(value.lastAt) ? value.lastAt : 0;
  return { version: 1, past, present, future, lastAt, typing: value.typing === true };
}

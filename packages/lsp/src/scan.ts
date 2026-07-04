/**
 * A position-aware scanner for `.lmd` documents, used by the language server for
 * completion, go-to-definition, references, and symbols. It mirrors the link
 * extraction in `lmd-core`'s `scan` but additionally records source ranges.
 *
 * Authoritative validation still comes from `@lmd/core`'s `check` (compiled from
 * the same Rust); this scanner only needs to locate things, not judge them.
 */

import { parseAddress } from "@lmd/core";

export interface Pos {
  line: number;
  character: number;
}
export interface Range {
  start: Pos;
  end: Pos;
}
export interface AnchorHit {
  slug: string;
  /** Range of the slug inside the anchor comment. */
  range: Range;
}
export interface EdgeHit {
  /** The raw address string as written. */
  target: string;
  rel: string;
  /** Range covering the address text (for go-to-definition). */
  range: Range;
}
export interface ScanResult {
  anchors: AnchorHit[];
  edges: EdgeHit[];
  /** Import namespace aliases declared in front matter. */
  imports: string[];
  /** 0-based line where the body begins (after front matter). */
  bodyStartLine: number;
}

const RE_ANCHOR = /<!--lmd:a\s+([a-z][a-z0-9-]*)(?:\s+rev=\d+)?\s*-->/g;
// A ref opener lists 1..N typed targets: <!--lmd:ref [role=]addr,… …-->.
const RE_REF_OPEN = /<!--lmd:ref\s+(.*?)\s*-->/g;

function frontmatter(lines: string[]): { imports: string[]; bodyStartLine: number } {
  if (lines[0]?.trim() !== "---") return { imports: [], bodyStartLine: 0 };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { imports: [], bodyStartLine: 0 };

  const imports: string[] = [];
  let inImports = false;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (/^imports:\s*$/.test(line) || /^imports:\s*\{/.test(line)) {
      inImports = true;
      // inline `imports: { ... }` is unusual; keep simple and continue
      continue;
    }
    if (inImports) {
      const m = line.match(/^\s{2}([a-z][a-z0-9-]*):/);
      if (m) imports.push(m[1]);
      else if (/^\S/.test(line)) inImports = false; // dedented to a new top-level key
    }
  }
  return { imports, bodyStartLine: end + 1 };
}

function eachMatch(re: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m);
  return out;
}

export function scan(text: string): ScanResult {
  const lines = text.split(/\r?\n/);
  const { imports, bodyStartLine } = frontmatter(lines);

  const anchors: AnchorHit[] = [];
  const edges: EdgeHit[] = [];
  let inFence = false;

  for (let line = bodyStartLine; line < lines.length; line++) {
    const text = lines[line];
    const trimmed = text.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const m of eachMatch(RE_ANCHOR, text)) {
      const slugStart = text.indexOf(m[1], m.index);
      anchors.push({
        slug: m[1],
        range: span(line, slugStart, m[1].length),
      });
    }

    for (const m of eachMatch(RE_REF_OPEN, text)) {
      for (const item of m[1].split(/\s+/).filter(Boolean)) {
        const eq = item.indexOf("=");
        const rel = eq > 0 ? item.slice(0, eq) : "related";
        for (const addr of (eq > 0 ? item.slice(eq + 1) : item).split(",")) {
          if (!addr || parseAddress(addr).kind === "external") continue;
          const at = text.indexOf(addr, m.index);
          edges.push({ target: addr, rel, range: span(line, at, addr.length) });
        }
      }
    }
  }

  return { anchors, edges, imports, bodyStartLine };
}

function span(line: number, character: number, length: number): Range {
  return { start: { line, character }, end: { line, character: character + length } };
}

/** True if `pos` falls within `range` (same line). */
export function inRange(range: Range, pos: Pos): boolean {
  return (
    pos.line === range.start.line &&
    pos.character >= range.start.character &&
    pos.character <= range.end.character
  );
}

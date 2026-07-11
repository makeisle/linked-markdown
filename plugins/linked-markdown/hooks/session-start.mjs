#!/usr/bin/env node
// SessionStart hook: surface the project's Linked Markdown graph so the agent
// begins each session already aware of the linked notes/specs/plans that exist —
// recall by presence, not by remembering to grep. Prints nothing when there are
// no .lmd files, and never throws (a hook must not break the session).

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP = new Set(["node_modules", ".git", "dist", "target", "pkg", ".vitepress"]);
const MAX = 24;

function findLmd(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 6 || out.length >= MAX * 2) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".lmd") continue;
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(join(dir, e.name), depth + 1);
      } else if (e.isFile() && e.name.endsWith(".lmd")) {
        out.push(join(dir, e.name));
      }
    }
  };
  walk(root, 0);
  return out;
}

function titleOf(file) {
  try {
    const head = readFileSync(file, "utf8").slice(0, 2000);
    const m = head.match(/^title:\s*(.+)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const files = findLmd(root);
  if (files.length === 0) process.exit(0);

  const lines = files.slice(0, MAX).map((f) => {
    const rel = relative(root, f).split(sep).join("/");
    const t = titleOf(f);
    return t ? `- ${rel} — ${t}` : `- ${rel}`;
  });
  const more = files.length > MAX ? `\n…and ${files.length - MAX} more.` : "";

  const context =
    `This project has ${files.length} Linked Markdown (.lmd) document${files.length === 1 ? "" : "s"} — ` +
    `a connected graph of notes, specs, and plans. Before assuming context is missing, ` +
    `consider these and their links (use \`/lmd-graph\` for the map):\n` +
    lines.join("\n") +
    more +
    `\nWhen this session produces decisions or a plan worth keeping, offer \`/lmd-capture\` ` +
    `to save it as a linked .lmd note.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
    }),
  );
} catch {
  // Stay silent on any error — never disrupt the session.
  process.exit(0);
}

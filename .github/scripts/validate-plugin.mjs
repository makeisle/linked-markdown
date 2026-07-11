#!/usr/bin/env node
// Validate the Claude Code plugin marketplace + plugin manifests and structure.
// Used by CI (every push) and the release workflow. Exits non-zero on any problem.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];
const err = (m) => errors.push(m);

function readJson(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    err(`missing file: ${rel}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    err(`invalid JSON in ${rel}: ${e.message}`);
    return null;
  }
}

// ── marketplace.json ────────────────────────────────────────────────────────
const market = readJson(".claude-plugin/marketplace.json");
if (market) {
  if (!market.name) err("marketplace.json: missing 'name'");
  if (!Array.isArray(market.plugins) || market.plugins.length === 0) {
    err("marketplace.json: 'plugins' must be a non-empty array");
  } else {
    for (const p of market.plugins) {
      if (!p.name) err("marketplace.json: a plugin entry has no 'name'");
      if (!p.source) err(`marketplace.json: plugin '${p.name}' has no 'source'`);
      else if (p.source.startsWith("./") && !existsSync(join(root, p.source))) {
        err(`marketplace.json: plugin '${p.name}' source not found: ${p.source}`);
      }
    }
  }
}

// ── each local plugin ───────────────────────────────────────────────────────
for (const p of market?.plugins ?? []) {
  if (!p.source?.startsWith("./")) continue;
  const dir = p.source;
  const manifest = readJson(join(dir, ".claude-plugin/plugin.json"));
  if (manifest) {
    if (!manifest.name) err(`${dir}: plugin.json missing 'name'`);
    if (!manifest.version) err(`${dir}: plugin.json missing 'version'`);
    if (market && manifest.version !== p.version) {
      err(`${dir}: version ${manifest.version} != marketplace entry ${p.version}`);
    }
  }
  // commands: each .md needs a frontmatter description.
  const cmdDir = join(root, dir, "commands");
  if (existsSync(cmdDir)) {
    for (const f of readdirSync(cmdDir).filter((f) => f.endsWith(".md"))) {
      const body = readFileSync(join(cmdDir, f), "utf8");
      if (!/^---[\s\S]*?description:/m.test(body)) {
        err(`${dir}/commands/${f}: missing frontmatter 'description'`);
      }
    }
  }
  // hooks: hooks.json must parse and reference an existing script if it's a file.
  const hooksPath = join(dir, "hooks/hooks.json");
  if (existsSync(join(root, hooksPath))) {
    const hooks = readJson(hooksPath);
    const cmds = JSON.stringify(hooks ?? {});
    for (const m of cmds.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\\]+)/g)) {
      const script = join(root, dir, m[1]);
      if (!existsSync(script)) err(`${dir}: hook references missing file ${m[1]}`);
    }
  }
  // skills: SKILL.md must have frontmatter name + description.
  const skillsDir = join(root, dir, "skills");
  if (existsSync(skillsDir)) {
    for (const s of readdirSync(skillsDir)) {
      const skill = join(skillsDir, s, "SKILL.md");
      if (!existsSync(skill)) err(`${dir}/skills/${s}: no SKILL.md`);
      else {
        const body = readFileSync(skill, "utf8");
        if (!/^---[\s\S]*?name:/m.test(body) || !/^---[\s\S]*?description:/m.test(body)) {
          err(`${dir}/skills/${s}/SKILL.md: frontmatter needs name + description`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error("Plugin validation FAILED:");
  for (const e of errors) console.error("  ✗ " + e);
  process.exit(1);
}
console.log("Plugin validation OK: marketplace + plugin manifests, commands, hooks, skills.");

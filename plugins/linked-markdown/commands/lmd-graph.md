---
description: Summarize the project's .lmd knowledge graph — documents, anchors, cross-links, and any dangling references.
argument-hint: "[optional: path or glob to scope to]"
allowed-tools: Bash, Read, Glob, Grep
---

Give the user a map of the project's Linked Markdown graph. Scope: `$ARGUMENTS`
(default: the whole project).

1. **Find the documents.** `Glob` for `**/*.lmd` (respecting any scope argument).
   For each, read the front matter (`id`, `title`, `version`, `imports`).

2. **Read the graph.** Prefer the tool over hand-parsing: run `lmd check <file>` on
   each document (or `cargo run -q -p lmd-cli -- check <file>` from the
   linked-markdown repo) to surface `dangling-local-ref`, `unknown-namespace`,
   `duplicate-slug`, and `stale-manifest` diagnostics. From each document's manifest
   (`nodes`, `edges`) collect the anchors and the resolved edges.

3. **Report**, concisely:
   - **Documents** — title, path, version, and anchor count.
   - **Cross-document links** — which document links to which, and via what role.
     A small text adjacency list is fine (e.g. `requirements → design (impacts ×3)`).
   - **Health** — dangling refs, undefined namespaces, duplicate slugs, stale
     manifests (with the file + fix: usually re-run `lmd build`).
   - **Orphans** — documents nothing links to, and anchors with no inbound edges, so
     the user can spot notes that fell out of the graph.

Do not modify any file — this command only reports.

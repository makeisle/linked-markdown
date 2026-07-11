# Linked Markdown — Claude Code plugin

Author `.lmd` documents and weave a project's **conversations, plans, and reference
docs** into a typed link graph — so a project's memory becomes something you
*traverse*, not something you have to remember to `grep` for.

This plugin is file-based: it writes and links plain `.lmd` files and reads the
graph back through the `lmd` CLI. There is no background server.

## Install

Add this repository as a plugin marketplace in Claude Code, then install the
plugin:

```
/plugin marketplace add makeisle/linked-markdown
/plugin install linked-markdown@linked-markdown
```

(Or point the marketplace at a local clone during development.)

The `lmd` CLI is used for `build`/`check`. Until published binaries exist, run it
from a clone of this repo: `cargo run -q -p lmd-cli -- <args>`.

## What you get

**Skill** — `linked-markdown`: the authoring playbook (anchors, refs, addresses,
roles, imports, the build/check discipline). Loads automatically when a task
involves `.lmd`.

**Commands**

| Command | Does |
|---|---|
| `/lmd-capture [title]` | Saves the current conversation — its decisions, plan, and touched files — as a `.lmd` note, anchored and linked into the project's existing documents. |
| `/lmd-link <src — text → :anchor …>` | Adds a typed ref linking a span of text to one or more anchors (local or cross-document). |
| `/lmd-graph [scope]` | Reports the project's `.lmd` graph: documents, cross-links, health (dangling refs, stale manifests), and orphans. Read-only. |

**Hook** — `SessionStart`: lists the project's existing `.lmd` documents as session
context, so the agent starts aware of the linked notes instead of assuming context
is missing. Silent when there are none.

## Why

The information an agent needs usually *exists* — in some earlier note or plan.
What fails is **recall**: wording drifts so keyword search misses it, and the agent
doesn't know to look for what it has forgotten. Deciding the connections at *write*
time (when context is fresh) and storing them as a real graph makes that
information reachable later by following edges. See the
[repository README](../../README.md) for the full rationale.

Apache-2.0.

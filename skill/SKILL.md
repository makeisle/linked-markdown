---
name: linked-markdown
description: >-
  Author and edit Linked Markdown (.lmd) documents — Markdown that carries a
  typed link graph, stable per-block UUIDs, cross-document namespace imports, and
  versioning inside invisible HTML comments and front matter. Use this whenever a
  task involves creating, editing, linking, or validating .lmd files, connecting
  documents into a knowledge graph, or maintaining the lmd manifest. Triggers
  include ".lmd", "linked markdown", "link these docs", "anchor this section".
---

# Authoring Linked Markdown (`.lmd`)

A `.lmd` file is ordinary Markdown plus (1) a YAML front-matter identity block and
(2) tiny `<!--lmd:… -->` comments that mark link targets and attach links. A
machine-managed manifest at the end records UUIDs, the resolved link graph, and
content hashes. To a reader it renders as plain Markdown.

The full normative rules are in `spec/SPEC.md`; the tutorial is `spec/SYNTAX.md`.
This skill is the operational playbook.

## The golden workflow — never skip the last two steps

After **any** edit to a `.lmd` file:

1. Edit the **body** and **front matter** by hand. Preserve every `<!--lmd:… -->`
   comment unless you are intentionally changing a link.
2. Run **`lmd build <file>`** — regenerates the manifest, mints UUIDs for new
   anchors, preserves UUIDs of existing ones, resolves links, refreshes hashes.
3. Run **`lmd check <file>`** — validates integrity. Fix every `error` before
   considering the task done. `warning`s are usually resolved by re-running build.

If the `lmd` binary is not installed, run it from the repo:
`cargo run -q -p lmd-cli -- build <file>` and `… -- check <file>`.

**Never hand-edit the `<!--lmd:manifest … -->` block.** It is generated; your
changes will be overwritten by the next `lmd build`. Edit the body; let build
own the manifest.

## What you write in the body

### Mark a block as linkable — an anchor

Append `<!--lmd:a <slug>-->` to the block. `slug` is lower-kebab-case, unique in
the document, chosen to be a stable human handle.

```markdown
## Authentication <!--lmd:a auth-->
```

Attachment by block kind: heading/paragraph → end of line; list item → end of the
item text; table row → end of the last cell; code block → the line *after* the
closing fence; image / `---` → end of line.

### Link to a target — two ways

- **Visible** (reader can click): a normal Markdown link to an *address*, with an
  optional role comment:
  ```markdown
  Must satisfy [the privacy invariant](:privacy)<!--lmd:ref rel=invariant-->.
  ```
- **Invisible** (attach edges without touching prose):
  ```markdown
  Users sign up through a trusted path.
  <!--lmd:rel impacts=:uc-join,:uc-approve parent=:capability-auth-->
  ```

### Address cheat-sheet

| Write | Means |
|---|---|
| `:slug` / `#slug` | a target in this document |
| `alias:slug` | a target in an imported document |
| `alias:slug@3` | …pinned to version 3 |
| `kg://…` | an external knowledge-graph node |
| `https://…`, `./x.md` | ordinary link (never an lmd edge) |

### Roles

Use a standard role when one fits: `source`, `parent`, `child`, `impacts`,
`impacted_by`, `invariant`, `policy`, `decided_by`, `approved_by`, `related`,
`see_also`. Free-form roles are allowed but standard ones render better.

## Cross-document links

To link into another document, add it to `imports` in front matter, then address
through the alias:

```markdown
---
lmd: 1
id: 0192f3a1-…-req0001
version: 1
title: Requirements
imports:
  design: { id: 0192f3a1-…-design001, pin: "@7" }
---

The flow is [use case: join](design:uc-join).
```

Use the *target document's* `id` (from its front matter) as the import `id`. Pin
a version with `pin: "@N"`. After editing imports, run `lmd build` so the
manifest lockfile and edge resolutions update.

## Creating a new document

```bash
lmd new spec.lmd --title "My specification"
```

This scaffolds a valid `.lmd` with a fresh document `id` and one anchor, already
built and checked.

## Common tasks → recipes

- **"Make this section linkable."** Add `<!--lmd:a <slug>-->` to its heading or
  block, then `lmd build` + `lmd check`.
- **"Link section A to section B."** On A's block add
  `<!--lmd:rel related=:b-slug-->` (or a visible link `[…](:b-slug)`), then build.
- **"Connect this doc to another doc's section."** Add the other doc to `imports`,
  reference `alias:their-slug`, then build.
- **"Why is check failing?"** `dangling-local-ref` → the `:slug` has no anchor;
  `unknown-namespace` → the alias is not in `imports`; `duplicate-slug` → two
  anchors share a slug; `stale-manifest` → just run `lmd build`.

## Editing discipline

- Keep slugs stable once linked; renaming a slug breaks inbound `:slug`
  references in other documents. Prefer adding an alias over renaming.
- One concern per edit; run build + check before moving on.
- Bump the front-matter `version` when the document's content meaningfully
  changes, so downstream pins and drift detection stay meaningful.

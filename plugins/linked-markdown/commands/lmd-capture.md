---
description: Capture this conversation — its decisions, plan, and the docs it touched — into a linked .lmd note connected to the project's other documents.
argument-hint: "[optional: note title or target path]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Capture the current session as a Linked Markdown (`.lmd`) note, connected into the
project's existing knowledge graph so it can be *recalled by traversal later*, not
just by searching for the right words. Follow the authoring rules in the
`linked-markdown` skill (`skills/linked-markdown/SKILL.md`).

**Argument:** `$ARGUMENTS` — an optional note title, or a target path. If empty,
title the note after what this session accomplished and save it under `.lmd/` at
the project root (create the directory if needed), filename kebab-cased from the
title.

Steps:

1. **Survey the graph.** `Glob` for existing `**/*.lmd` in the project. Read their
   front matter (`id`, `title`) and their anchors (`<!--lmd:a slug-->`) so you know
   what this note can link to. Note the ones this session actually relates to.

2. **Draft the note body** — concise, factual, skimmable. Suggested sections, each
   marked as an anchor so others can link to them:
   - `## Summary <!--lmd:a summary-->` — what this session was about and the outcome.
   - `## Decisions <!--lmd:a decisions-->` — what was decided and *why* (the why is
     what grep can't reconstruct later).
   - `## Plan / next steps <!--lmd:a plan-->` — what remains, if anything.
   - `## Touched <!--lmd:a touched-->` — key files/areas changed, as a list.
   Write real content from this conversation — do not invent.

3. **Link it in.** Where the note relates to an existing `.lmd`, add that document
   to `imports` in the front matter (use its `id`; add a `path`) and wrap the
   relevant text with a ref: `<!--lmd:ref alias:their-anchor-->…<!--/lmd-->`. For
   links within this note, use `:local-slug`. Choose relationship roles that fit
   (`impacts`, `decided_by`, `parent`, `related`, …). Do not overlink — link where a
   future reader would genuinely want the jump.

4. **Build and validate.** Run `lmd build <file>` then `lmd check <file>` and fix
   every `error`. If the `lmd` binary isn't installed, use the repo:
   `cargo run -q -p lmd-cli -- build <file>` / `… -- check <file>`. Never hand-edit
   the trailing `<!--lmd:manifest …-->` block — build owns it.

5. **Report** the path written, the anchors created, and every edge added (both
   in-note and cross-document), so the user sees exactly how this note joined the
   graph.

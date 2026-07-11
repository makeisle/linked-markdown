---
description: Link a span of text in one .lmd document to one or more anchors, in this document or another.
argument-hint: "<source .lmd> — <what to link> → <:anchor or alias:anchor …>"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Add a typed link (a **ref**) in a `.lmd` document, following the `linked-markdown`
skill. Request: `$ARGUMENTS`.

1. **Resolve the pieces.** Identify the source document, the span of visible text to
   wrap, and the target anchor(s). If any is ambiguous, `Glob`/`Read` the project's
   `.lmd` files to find candidate anchors and confirm the exact `:slug` (local) or
   `alias:slug` (cross-document) before editing. If the user didn't name a target,
   propose the best-matching anchors and ask.

2. **For a cross-document target**, ensure the target doc is in the source's
   `imports` front matter (add it with the target's `id` and a `path`), then address
   through `alias:slug`.

3. **Wrap the text**: `<!--lmd:ref [role=]addr,… …-->the source text<!--/lmd-->`.
   Pick a relationship role that fits (`related` is the default; prefer a precise
   one — `impacts`, `invariant`, `parent`, `see_also`, …). One ref can point at
   several anchors — list them: `<!--lmd:ref :a,:b refines=:c-->…<!--/lmd-->`.

4. **Build + check**: `lmd build <file>` then `lmd check <file>` (or
   `cargo run -q -p lmd-cli -- …` from the linked-markdown repo). Fix every error.

5. **Report** the edge(s) created and their resolved targets.

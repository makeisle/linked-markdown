# Linked Markdown Specification — v1

> Status: **frozen** for the v1 milestones. Changes follow the process in
> [`../GOVERNANCE.md`](../GOVERNANCE.md) and must be pinned by a fixture in
> [`../conformance/`](../conformance/).

Linked Markdown (`.lmd`) is Markdown that additionally encodes a typed link
graph, stable per-block identity, cross-document namespace imports, and
versioning. All of that metadata lives in YAML front matter and HTML comments,
so a `.lmd` file renders as ordinary Markdown in any CommonMark/GFM renderer.

## 0. Identity

- **Extension**: `.lmd`
- **MIME**: `text/markdown; variant=lmd`
- **Encoding**: UTF-8, no BOM. Newlines are LF; CRLF is normalized to LF on parse.
- **Spec version**: carried by the `lmd:` front-matter key. This document is `lmd: 1`.
- The spec version is independent from implementation package versions.

## 1. Principles

1. **Renders as plain Markdown.** Every piece of link metadata lives in
   `<!--lmd:… -->` HTML comments or YAML front matter, both invisible in rendered
   output.
2. **Human handles in the body, global identity in the manifest.** The body
   refers to blocks by short, human-readable `slug`s; the manifest binds each
   slug to a UUID. Slugs and UUIDs evolve independently.
3. **Vectors live outside the file.** Embeddings are *not* stored in `.lmd`. The
   file is the source of truth for *connectivity*; a node's UUID is the join key
   into any external vector store. "AI-readable" is achieved through (a) explicit
   typed edges and (b) the UUID join — not by inlining floats.
4. **Versioned links.** A document has a `version`; cross-document references
   pin a target version, and the import table is a lockfile.
5. **Canonical form.** Tools that regenerate a file produce byte-stable output
   (§8) so diffs stay clean.

## 2. The three zones

A `.lmd` file is exactly three zones, in order:

| Zone | Holds | Edited by | On render |
|---|---|---|---|
| **Front matter** (YAML) | document `id`/`version`/`title`, `imports` | human + tools | hidden |
| **Body** (Markdown + escape comments) | content + lightweight anchor/ref markers | human | clean Markdown |
| **Manifest** (trailing HTML comment, JSON) | UUID bindings, edges, import lock, hashes | tools only | removed |

The manifest is always the final block of the file.

## 3. Front matter

```yaml
---
lmd: 1
id: 0192f3a1-7c2e-7b3d-9f10-aa01cap00001     # document UUID (UUIDv7 recommended)
version: 3                                    # integer, bumped on content change
title: Membership specification
imports:                                      # namespace alias -> imported doc
  design: { id: 0192…design0001, path: "design/architecture.lmd", pin: "@7" }
  policy: { id: 0192…policy0001, path: "policy/security.lmd", range: ">=2 <3", pin: "@2" }
---
```

| Key | Required | Meaning |
|---|---|---|
| `lmd` | yes | spec version (`1`) |
| `id` | yes | document UUID (global, immutable) |
| `version` | yes | document version (integer) |
| `title` | yes | display title |
| `imports` | no | alias → `{ id, path?, pin?, range? }` |

For an import: `id` is the imported document's UUID (the durable identity); `path`
is a *hint* to where that document lives — a workspace-relative or network path.
The path may drift as files move; `id` does not, so a tool that cannot find the
document at `path` re-locates it by scanning for `id` and updates the hint. `pin`
is the resolved concrete version (e.g. `"@7"`); `range` is an allowed band that
`build` resolves a pin within. With neither, the reference floats to the target's
current version.

## 4. Body — escape tags

Beyond plain Markdown, a `.lmd` body uses exactly **two** escape-tag constructs,
both invisible in any Markdown renderer:

- an **anchor** marks a block as a linkable target;
- a **ref** wraps a span of text and links it to one or more anchors.

That is the whole link model. Anchors are pure targets — they carry a UUID and
nothing else, and never hold outgoing links. Refs are the *only* way to link, and
a single ref may point at **1..N anchors, each with its own relationship type**.

> A normal Markdown link `[text](url)` is just a hyperlink to a URL. It is **not**
> an lmd link and carries no lmd meaning — lmd links live only in the escape tags.

### 4.1 Anchor — a link target

```markdown
## Membership authentication <!--lmd:a cap-auth-->
```

A self-closing tag at the end of a block. `slug` matches `[a-z][a-z0-9-]*` and is
unique in the document; optional `rev=N` sets a node revision (default 1). An
anchor only marks a target. The manifest binds
`slug → { uuid, kind, hash, origin? }`.

Attachment position by block kind:

| Block | Position |
|---|---|
| heading / paragraph | end of the same line |
| list item | end of the item's inline text |
| table row | end of the last cell's text |
| code block | the line **after** the closing fence |
| image / thematic break | end of the same line |

### 4.2 Ref — a typed link from a span to 1..N anchors

A ref **wraps its source text** between an opening tag and a close:

```markdown
Everything hangs on <!--lmd:ref :extraction-->the extraction<!--/lmd-->.

<!--lmd:ref covers=:lexer,:parser,:sema refines=:codegen-->the front end<!--/lmd-->
turns your language into an IR.
```

- Open `<!--lmd:ref <targets>-->`, close `<!--/lmd-->`. The text between is the
  visible **source** (rendered as a link; in a plain renderer the comments vanish
  and it is ordinary text).
- `<targets>` is one or more space-separated items; each item is
  `[<role>=]<address>[,<address>…]` (§5, §6). A bare address list takes the
  default role `related`. **The syntax is identical for 1 target or many** — you
  only add more addresses.
- Refs do not nest.

| Written | Meaning |
|---|---|
| `<!--lmd:ref :parser-->the parser<!--/lmd-->` | one edge → `:parser` (`related`) |
| `<!--lmd:ref :lexer,:parser-->the front half<!--/lmd-->` | two `related` edges |
| `<!--lmd:ref covers=:lexer,:parser refines=:sema-->…<!--/lmd-->` | typed edges |

## 5. Addresses

```
address   := [ namespace ":" ] ( slug | uuid ) [ "@" version ]
local      := ( ":" | "#" ) slug
```

| Example | Meaning |
|---|---|
| `:cap-auth` / `#cap-auth` | same-document anchor |
| `design:cap-auth` | `cap-auth` in the `design` namespace document |
| `design:0192…0001` | a target addressed by UUID |
| `policy:perf@2` | pin the target document to version 2 |
| `kg://0192…` | an external knowledge-graph node (opaque to lmd-core) |

Ordinary link targets (`https://…`, `./file.md`) are **external** and never
become edges.

### 5.1 Resolution

1. Split a trailing `@version`.
2. A `:`/`#` prefix → **local**: look up `nodes[slug]` in this document.
3. An `alias:` prefix → **cross-document**: look up `imports[alias]`; the target
   version is the `@version`, else the import `pin`, else the resolved `range`,
   else the target's current version.
4. `kg://` → passed through as an external reference.
5. An undefined alias or a missing local slug is a `check` error.

## 6. Relationship roles

Standard roles (a viewer may give each a color/icon):

`source`, `parent`, `child`, `impacts`, `impacted_by`, `invariant`, `policy`,
`decided_by`, `approved_by`, `related`, `see_also`.

Free-form role strings are permitted; the standard set is recommended.

## 7. Manifest

```jsonc
<!--lmd:manifest
{
  "schema": 1,
  "body_hash": "sha256:…",
  "nodes": {
    "cap-auth": {
      "uuid": "0192…a2", "kind": "heading", "rev": 1, "hash": "sha256:…",
      "origin": { "layer": "S2b", "node": "0192…c1", "field": "goal" }
    }
  },
  "edges": [
    { "from": "cap-auth", "rel": "impacts", "to": "design:uc-join",
      "resolved": { "doc": "0192…design0001", "version": 7, "uuid": "0192…uc1", "hash": "sha256:…" } }
  ],
  "imports": { "design": { "id": "0192…design0001", "version": 7, "hash": "sha256:…" } }
}
-->
```

| Path | Meaning |
|---|---|
| `schema` | manifest schema version |
| `body_hash` | SHA-256 of the canonical body; detects body↔manifest drift |
| `nodes.<slug>.uuid` | global identity; **the external vector-store join key** |
| `nodes.<slug>.kind` | `heading`/`para`/`list-item`/`table-row`/`code`/`quote`/`image`/`hr` |
| `nodes.<slug>.rev` | node revision (mirrors `rev=`) |
| `nodes.<slug>.hash` | hash of the block's visible text |
| `nodes.<slug>.origin` | optional provenance `{ layer, node, field }` (§7.1) |
| `nodes.<slug>.embed` | optional embedding pointer `{ model, at, hash }` — **never a vector** |
| `edges[].from` | source slug |
| `edges[].rel` | role (§6) |
| `edges[].to` | the address string as written |
| `edges[].uuid` | resolved UUID for a local target |
| `edges[].resolved` | cross-document resolution `{ doc, version, uuid?, hash? }`; `hash` is the target's content hash at link time → drift detection |
| `imports.<alias>` | resolved import lock `{ id, version, hash? }` |

### 7.1 Provenance (`origin`)

`origin` is a generic, vendor-neutral provenance tuple — `layer`, `node`,
`field` — for projecting human edits back into some source-of-truth system. The
format does not interpret these strings; a consumer defines their meaning.

## 8. Canonical form

1. **Front matter**: keys in the order `lmd, id, version, title, imports`;
   `imports` alphabetical by alias.
2. **Escape comments**: `<!--lmd:<op>` + single space + args + single space + `-->`.
3. **Manifest JSON**: 2-space pretty-print; object keys in declared order
   (`uuid` first within a node); map keys alphabetical; `edges` sorted by
   `(from, rel, to)` and de-duplicated (identical `(from, rel, to)` collapses to
   one edge).
4. **Slugs**: `[a-z][a-z0-9-]*`.
5. LF newlines; exactly one trailing newline.
6. `body_hash` is computed over the body only (manifest excluded).

> v0.1 note: the reference implementation normalizes front matter and the
> manifest; in-body escape-comment spacing is preserved verbatim and will be
> normalized in a later revision (tracked by conformance).

## 9. Integrity gates (`check`)

| Gate | Severity |
|---|---|
| duplicate slug | error |
| dangling local ref (`:slug` with no anchor) | error |
| undefined namespace (`alias:` not imported) | error |
| edge attached to no anchor | error |
| `body_hash` mismatch (stale manifest) | warning |

## 10. Conformance

An implementation is conformant when it passes the fixtures in
[`../conformance/`](../conformance/). The Rust crate `lmd-core` is the reference
implementation, but the fixtures — not the crate — are the contract.

## 11. Future (v2 candidates)

Inline span-level anchors; collaboration comment track; document change log;
automatic backlink generation; formalized `embed` provenance; link deprecation
(`revoke`).

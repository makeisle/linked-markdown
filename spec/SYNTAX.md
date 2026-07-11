# Linked Markdown — Syntax Guide

A friendly, example-first tour. For the normative rules see
[`SPEC.md`](https://github.com/makeisle/linked-markdown/blob/main/spec/SPEC.md).

## The one-minute version

A `.lmd` file is a normal Markdown file with two extra things:

1. a small **YAML front matter** block at the top giving the document an identity, and
2. tiny **`<!--lmd:… -->` comments** in the body that mark blocks as link targets
   or attach links between them.

Both are invisible when the Markdown is rendered. A machine-managed manifest at
the bottom (also an HTML comment) records UUIDs, the resolved link graph, and
hashes — you never write that by hand; `lmd build` does.

## Your first document

```markdown
---
lmd: 1
id: 0192f3a1-7c2e-7b3d-9f10-aa01intro0001
version: 1
title: Getting started
---

# Getting started <!--lmd:a intro-->

Welcome. This whole paragraph is now a linkable block named `intro`.
```

Run `lmd build getting-started.lmd` and a manifest appears at the end binding
`intro` to a freshly minted UUID. Run `lmd check` to validate it.

## Marking a block as a target — *anchors*

Put `<!--lmd:a <slug>-->` at the end of the block:

```markdown
## Authentication <!--lmd:a auth-->
- Email + password sign-up <!--lmd:a auth-email-->
- Social login <!--lmd:a auth-social-->
```

`slug`s are your human-friendly handles. They must be unique in the document and
look like `lower-kebab-case`.

## Linking — wrap the source text with a ref

A **ref** wraps a span of text and links it to one or more anchors. Open with
`<!--lmd:ref <targets>-->`, close with `<!--/lmd-->`:

```markdown
See <!--lmd:ref :auth-->authentication<!--/lmd--> for details.
```

`:auth` means "the `auth` anchor in this document". In a plain Markdown renderer
the comments vanish and you just read "authentication" — but it is a link.

Give each target a role, and list as many targets as you like — **the syntax is
the same whether there is 1 or many**:

```markdown
This must satisfy <!--lmd:ref invariant=:privacy-->the privacy invariant<!--/lmd-->.

Users sign up through <!--lmd:ref impacts=:uc-join,:uc-approve parent=:capability-auth-->a trusted path<!--/lmd-->.
```

The second ref adds three typed edges (`impacts`, `impacts`, `parent`) from one
span. A bare address list (no `role=`) uses the default role `related`.

> An anchor is only a target — it never holds links. A normal Markdown link
> `[text](url)` is just a URL hyperlink and has no lmd meaning.

## Linking across documents

Declare a namespace in front matter, then address through it:

```markdown
---
lmd: 1
id: 0192f3a1-…-req0001
version: 1
title: Requirements
imports:
  design: { id: 0192f3a1-…-design001, pin: "@7" }
---

The flow is <!--lmd:ref design:uc-join-->specified elsewhere<!--/lmd-->.
```

`design:uc-join` resolves through the `design` import to version 7 of that
document. Pin a specific version inline with `@`: `design:uc-join@5`.

## Addresses at a glance

| You write | It means |
|---|---|
| `:slug` or `#slug` | a target in *this* document |
| `alias:slug` | a target in an imported document |
| `alias:slug@3` | …pinned to version 3 |
| `kg://…` | an external knowledge-graph node |
| `https://…`, `./x.md` | an ordinary link (never an lmd edge) |

## Relationship roles

Each target in a ref may carry a role (`<!--lmd:ref role=:target-->…<!--/lmd-->`).
The standard set:

`source`, `parent`, `child`, `impacts`, `impacted_by`, `invariant`, `policy`,
`decided_by`, `approved_by`, `related`, `see_also`.

You may invent your own role string; the standard ones just get nicer treatment
in viewers.

## The workflow

```bash
lmd new spec.lmd --title "My spec"   # scaffold
# …edit the body, add anchors and links…
lmd build spec.lmd                   # (re)generate the manifest, resolve links
lmd check spec.lmd                   # validate: unique slugs, no dangling refs…
lmd graph spec.lmd                   # print the link graph
```

`build` is safe to run repeatedly: it preserves the UUIDs of blocks it has seen
before and only mints new ones for new slugs.

## What you never hand-write

The `<!--lmd:manifest … -->` block. It is generated, it holds UUIDs and content
hashes, and editing it by hand will just be overwritten by the next `lmd build`.

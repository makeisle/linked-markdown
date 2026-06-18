# Linked Markdown — Syntax Guide

A friendly, example-first tour. For the normative rules see [`SPEC.md`](SPEC.md).

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

## Linking to a target

### A link the reader can click

Just write a normal Markdown link whose URL is an *address*:

```markdown
See [authentication](:auth) for details.
```

`:auth` means "the `auth` anchor in this document". To add a role, follow the
link with a ref comment:

```markdown
This must satisfy [the privacy invariant](:privacy)<!--lmd:ref rel=invariant-->.
```

### An invisible, semantic link

When you don't want to change the prose, attach edges to the block directly:

```markdown
Users sign up through a trusted path.
<!--lmd:rel impacts=:uc-join,:uc-approve parent=:capability-auth-->
```

This adds three typed edges (`impacts`, `impacts`, `parent`) from the current
block — without altering a single visible character.

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

The flow is specified by [use case: join](design:uc-join).
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

`<!--lmd:rel-->` and `<!--lmd:ref rel=…-->` take a role. The standard set:

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

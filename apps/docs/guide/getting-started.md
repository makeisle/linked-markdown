# Getting started

Linked Markdown (`.lmd`) is a Markdown file with two extra things, both invisible
when rendered:

1. a small **YAML front matter** block giving the document an identity, and
2. tiny **`<!--lmd:… -->` comments** that mark blocks as link targets or attach
   links between them.

A machine-managed manifest at the bottom records UUIDs, the resolved link graph,
and content hashes. You never write it by hand — `lmd build` does.

## Install the CLI

```bash
cargo install --path crates/lmd-cli   # from a checkout
# or build the workspace
cargo build --release
```

## Your first document

```bash
lmd new spec.lmd --title "My spec"
```

```markdown
---
lmd: 1
id: 0192f3a1-7c2e-7b3d-9f10-aa01intro0001
version: 1
title: My spec
---

# My spec <!--lmd:a intro-->

Welcome. This whole paragraph is now a linkable block named `intro`.
```

## The loop

```bash
lmd build spec.lmd   # (re)generate the manifest, resolve links, refresh hashes
lmd check spec.lmd   # validate: unique slugs, no dangling refs, known namespaces
lmd graph spec.lmd   # print the link graph
```

`build` is safe to run repeatedly: it keeps the UUIDs of blocks it has seen and
only mints new ones for new slugs.

## In the browser

The same core compiles to WebAssembly. `@lmd/core` exposes `parse` / `build` /
`check` / `serialize`; `@lmd/viewer` renders a document with a link-graph
overlay; `@lmd/editor` is a TipTap WYSIWYG editor that keeps the link graph
intact while you edit. The **playground** wires all three together.

Next: the [syntax guide](./syntax) and the [specification](./spec).

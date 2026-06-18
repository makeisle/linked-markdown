<!-- markdownlint-disable MD041 -->
# Linked Markdown (`.lmd`)

> Markdown you can read as plain prose — and that AI and tools read as a typed
> knowledge graph.

Linked Markdown is a document format and tool ecosystem. To a human it renders as
ordinary Markdown; inside, every linkable block carries a stable identity (UUID),
typed edges to other blocks and documents, cross-document namespace imports, and
versioning — all encoded in HTML comments and front matter that disappear on render.

- **Looks like Markdown.** All link metadata lives in `<!--lmd:… -->` escape
  comments and YAML front matter, invisible in every CommonMark/GFM renderer.
- **Identity, not guesswork.** Each anchor has a UUID. That UUID is the join key
  into any external vector store, so embeddings live outside the file while the
  file stays the source of truth for *connectivity*.
- **Versioned links.** Cross-document references resolve through an import lockfile
  (`namespace:slug@version`) and carry content hashes for drift detection.

See **[`spec/SPEC.md`](spec/SPEC.md)** for the full v1 specification and
**[`spec/SYNTAX.md`](spec/SYNTAX.md)** for a tutorial-style syntax guide.

## Repository layout

This is a hybrid Rust + JavaScript monorepo.

```
crates/
  lmd-core/     Reference implementation: model, parser, serializer (canonical),
                address resolver, build & check. Pure Rust, no I/O assumptions.
  lmd-cli/      The `lmd` command-line tool.
  lmd-wasm/     wasm-bindgen bindings that expose lmd-core to JavaScript.
packages/
  @lmd/core     Thin TypeScript wrapper around the wasm bindings (browser + node).
  @lmd/editor   TipTap / ProseMirror WYSIWYG editor for .lmd (React, chip node views).
  @lmd/viewer   Renderer with link-graph overlay (refs, backlinks).
  @lmd/lsp      Language server: diagnostics, completion, definition, references, symbols.
apps/
  playground    Live editor + viewer demo.
  docs          Documentation site (spec, syntax guide, tutorials).
extensions/
  vscode        VS Code extension: .lmd grammar + language-server client.
skill/          A Claude skill for authoring .lmd documents.
conformance/    Golden fixtures + runner. The authority for "is this a valid
                lmd implementation?" — shared by every implementation.
examples/       Sample documents and multi-document workspaces.
```

## The reference implementation is the spec made executable

`crates/lmd-core` is the canonical implementation. Any other implementation
(a future pure-TS port, a Go port, etc.) is "correct" exactly when it passes the
shared fixtures in `conformance/`. The Rust crate compiles natively for the CLI
and to WebAssembly for the browser/editor/viewer — one source of truth, two targets.

## Status

Pre-alpha. The spec is at **v1** and frozen for the initial milestones; the
implementation is being built bottom-up (core → skill → viewer → editor → docs).

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

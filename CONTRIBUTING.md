# Contributing to Linked Markdown

Thanks for your interest. Linked Markdown is a format first and a toolchain
second — so the bar for changes that touch the *format* is deliberately high,
while tooling and docs move faster.

## Two kinds of change

1. **Spec changes** (anything under `spec/`, or any change to the bytes a
   conformant implementation must produce). These require:
   - A written rationale (open an issue first).
   - New or updated fixtures under `conformance/` that pin the behavior.
   - A version bump discussion — the spec is versioned independently from the
     packages (see `spec/SPEC.md` §0).
2. **Tooling / docs changes** (CLI ergonomics, editor UX, viewer, examples).
   These follow ordinary review; just make sure existing conformance fixtures
   still pass.

## The golden rule: conformance is the contract

`crates/lmd-core` is the reference implementation, but the *spec* is what
`conformance/` encodes. If you change parser or serializer behavior, a
conformance fixture must change with it — never one without the other. A PR that
changes output bytes without touching `conformance/` will be asked to add a fixture.

## Local setup

```bash
# Rust side
cargo build
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings

# JS side — build the wasm package first; the TS workspace depends on it.
pnpm install
pnpm run wasm          # wasm-pack build → packages/core/pkg
pnpm -r build
pnpm -r test
```

> Editing anything under `crates/lmd-core` (or `lmd-wasm`)? Re-run `pnpm run wasm`
> before `pnpm -r test`, or the JS tests run against a stale wasm build.

## Running the demo locally

```bash
pnpm --filter @lmd/playground dev   # viewer + editor at http://localhost:5173
pnpm --filter @lmd/docs dev         # documentation site
```

The hosted demo is built and deployed from `apps/playground` + `apps/docs` by
`.github/workflows/pages.yml`.

## Working on the Claude plugin / skill

- The authoring **skill** lives in `skill/SKILL.md` and is mirrored into the
  plugin under `plugins/linked-markdown/`.
- The repo root is a Claude Code plugin **marketplace** (`.claude-plugin/marketplace.json`).
  To try the plugin locally, add this repo as a marketplace in Claude Code and
  install the `linked-markdown` plugin.
- Provider-neutral and ChatGPT/Gemini authoring configs live under `integrations/`.
  Keep the authoring rules in sync with `spec/SYNTAX.md` — that file is the source
  of truth for the human-facing syntax.

## Commit / PR conventions

- Keep PRs scoped to one concern.
- Conventional-commit-style subjects are appreciated but not enforced.
- All contributions are accepted under the Apache-2.0 license (see `LICENSE`).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

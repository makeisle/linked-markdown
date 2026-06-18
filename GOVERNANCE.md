# Governance

Linked Markdown is in its founding phase. Governance is intentionally light now
and will formalize as the contributor base grows.

## Roles

- **Maintainers** — merge rights, release authority, final say on spec changes.
  The founding maintainer is the `makeisle` organization.
- **Contributors** — anyone who opens an issue or PR.

## Decision making

- **Tooling, docs, examples**: lazy consensus. A maintainer approval merges.
- **Spec changes** (`spec/` or conformance-affecting): require an issue with
  rationale, a fixture, and explicit maintainer sign-off. The spec version is
  bumped per `spec/SPEC.md` §0. Backwards-incompatible changes require a new
  major spec version and a migration note.

## Versioning

- The **spec** carries its own version (the `lmd:` front-matter key, currently `1`).
- The **packages** (`lmd-core`, `@lmd/*`) follow semver independently and are
  released with changesets.
- A package release never silently changes spec-level behavior; that path always
  goes through a spec change.

## Vendor neutrality

The format is vendor-neutral. Implementations may layer their own semantics on
top (for example, provenance fields pointing into a domain-specific knowledge
graph), but `crates/lmd-core` and the spec must remain free of any single
vendor's concepts. Domain coupling belongs in downstream consumers, not here.

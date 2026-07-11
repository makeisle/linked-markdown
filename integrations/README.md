# Integrations — using Linked Markdown with any AI

Linked Markdown's authoring guidance is model-agnostic. This folder packages it for
assistants other than Claude (which has a native [skill](../skill/) and
[plugin](../plugins/linked-markdown/)).

- **[`portable.md`](portable.md)** — the provider-neutral authoring instructions.
  The single source; the wrappers below are thin framings of it.
- **[`chatgpt/`](chatgpt/)** — set up a **Custom GPT** (GPT Store).
- **[`gemini/`](gemini/)** — set up a **Gem** (Gemini).

## What these can and can't do

These are **instructions-based**. A chat assistant authors the `.lmd` body and front
matter correctly, but it generally **cannot run the `lmd` CLI**, so it can't generate
the manifest or validate — you run `lmd build` and `lmd check` afterward. (Claude
Code, via the plugin, *can* run the CLI, so it closes that loop itself.)

## Publishing

The GPT Store and Gemini's Gem directory are **manually submitted** — there is no
public API to publish or update them from CI, so these configs are kept in the repo
and published by a human. Automatable channels (npm, crates.io, the VS Code
Marketplace, the Claude plugin marketplace) are handled by
[`.github/workflows/release.yml`](../.github/workflows/release.yml).

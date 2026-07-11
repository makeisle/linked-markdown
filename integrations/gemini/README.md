# Linked Markdown — Gemini Gem

Set up a Gem that authors `.lmd`. Instructions-based; the user runs
`lmd build`/`check` on the output.

## Create it

1. Go to [gemini.google.com](https://gemini.google.com) → **Gems** → **New Gem**
   (Gem creation availability depends on your Google account/plan).
2. **Name:** `Linked Markdown Author`.
3. **Instructions:** paste the contents of [`instructions.md`](instructions.md).
4. **Knowledge (if available):** attach [`spec/SPEC.md`](../../spec/SPEC.md) and
   [`spec/SYNTAX.md`](../../spec/SYNTAX.md) so the Gem can quote exact rules.
5. Save. Share via link if your plan allows.

## Publishing note

Gemini's Gem sharing has no public API to publish/update from CI, so this is a
manual step. Keep this folder in sync with [`../portable.md`](../portable.md).

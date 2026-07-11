# Linked Markdown — ChatGPT Custom GPT

Set up a Custom GPT that authors `.lmd`. Instructions-based (no Actions/code
interpreter needed); the user runs `lmd build`/`check` on the output.

## Create it

1. ChatGPT → **Explore GPTs → Create** (a paid plan is required to build a GPT).
2. In **Configure**:
   - **Name:** `Linked Markdown Author`
   - **Description:** `Writes .lmd — Markdown that carries a typed link graph. Reads as plain prose, links as a graph.`
   - **Instructions:** paste the contents of [`instructions.md`](instructions.md).
   - **Conversation starters** (see [`conversation-starters.txt`](conversation-starters.txt)).
   - **Knowledge:** upload [`spec/SPEC.md`](../../spec/SPEC.md) and
     [`spec/SYNTAX.md`](../../spec/SYNTAX.md) so it can quote the exact rules.
   - **Capabilities:** you can turn Web Search on; Code Interpreter and DALL·E are
     not needed. No Actions required.
3. Save. Set visibility to **Anyone with a link** or **Public** (GPT Store) as you
   prefer.

## Publishing note

The GPT Store has no public publish API, so submitting/updating the GPT is a manual
step. Keep this folder in sync with [`../portable.md`](../portable.md) and re-paste
when the format changes.

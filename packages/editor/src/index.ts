/**
 * `@lmd/editor` — editing Linked Markdown.
 *
 * Two layers:
 * - **Headless round-trip** (no React, no DOM): {@link lmdSchema},
 *   {@link parseLmdBody}, {@link serializeLmdBody}, and the TipTap JSON bridge
 *   {@link markdownToTiptap} / {@link tiptapToMarkdown}. Tested by `test/`.
 * - **TipTap React editor**: {@link LmdEditor} (with toolbar) plus the
 *   {@link LmdComment} / {@link LmdBlockComment} node extensions that render lmd
 *   escape comments as chips. Validated end-to-end by the playground app.
 *
 * lmd escape comments are preserved as atom nodes throughout, so the link graph
 * is never lost in editing — `lmd-core build` re-derives it from the output.
 */

// Headless round-trip
export { lmdSchema } from "./schema.js";
export { lmdMarkdownParser, lmdMarkdownSerializer, parseLmdBody, serializeLmdBody } from "./markdown.js";
export { markdownToTiptap, tiptapToMarkdown } from "./bridge.js";

// TipTap React editor
export { LmdEditor, type LmdEditorProps } from "./LmdEditor.js";
export { Toolbar } from "./Toolbar.js";
export { LmdComment, LmdBlockComment } from "./extensions.js";
export { CommentChip, describeComment } from "./chip.js";

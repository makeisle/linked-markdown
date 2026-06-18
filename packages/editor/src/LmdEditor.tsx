/**
 * `LmdEditor` — a TipTap-based WYSIWYG editor for a Linked Markdown body.
 *
 * Input and output are `.lmd` body Markdown; conversion goes through the tested
 * `lmd-core` round-trip via {@link ./bridge}. lmd escape comments render as chips
 * (see {@link ./extensions}) and survive editing intact, so running `lmd build`
 * on the output keeps the link graph.
 *
 * The component is uncontrolled: it initializes from `value` and emits Markdown
 * through `onChange`. To load a different document, change the `key` prop.
 */

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import * as React from "react";
import { markdownToTiptap, tiptapToMarkdown } from "./bridge.js";
import { LmdComment, LmdBlockComment } from "./extensions.js";
import { Toolbar } from "./Toolbar.js";

export interface LmdEditorProps {
  /** Initial `.lmd` body Markdown. */
  value: string;
  /** Called with the body Markdown on every edit. */
  onChange?: (body: string) => void;
  /** Extra class on the wrapper. */
  className?: string;
}

export function LmdEditor({ value, onChange, className }: LmdEditorProps) {
  const editor = useEditor({
    // Avoid a synchronous first render so React node views don't call flushSync
    // during the host component's render pass.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ strike: false }),
      Link.configure({ openOnClick: false }),
      LmdComment,
      LmdBlockComment,
    ],
    content: markdownToTiptap(value),
    onUpdate: ({ editor }) => onChange?.(tiptapToMarkdown(editor.getJSON())),
  });

  return (
    <div className={`lmd-editor${className ? ` ${className}` : ""}`}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="lmd-editor__content" />
    </div>
  );
}

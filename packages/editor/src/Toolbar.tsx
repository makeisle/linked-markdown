/** A minimal formatting toolbar for {@link LmdEditor}. */

import type { Editor } from "@tiptap/react";
import * as React from "react";

function Btn({
  editor,
  label,
  title,
  isActive,
  run,
}: {
  editor: Editor;
  label: string;
  title: string;
  isActive?: boolean;
  run: () => void;
}) {
  return (
    <button
      type="button"
      className={`lmd-tb__btn${isActive ? " is-active" : ""}`}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );
}

export function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const c = () => editor.chain().focus();

  function insertAnchor() {
    const slug = window.prompt("Anchor slug (lower-kebab-case):")?.trim();
    if (!slug) return;
    c().insertContent({ type: "lmd_comment", attrs: { raw: `<!--lmd:a ${slug}-->` } }).run();
  }

  function insertRef() {
    const target = window.prompt("Link target (e.g. :slug or alias:slug):")?.trim();
    if (!target) return;
    const text = window.prompt("Link text:", target)?.trim() || target;
    c().insertContent(`[${text}](${target})`).run();
  }

  return (
    <div className="lmd-tb">
      <Btn editor={editor} label="B" title="Bold" isActive={editor.isActive("bold")} run={() => c().toggleBold().run()} />
      <Btn editor={editor} label="I" title="Italic" isActive={editor.isActive("italic")} run={() => c().toggleItalic().run()} />
      <Btn editor={editor} label="‹›" title="Code" isActive={editor.isActive("code")} run={() => c().toggleCode().run()} />
      <span className="lmd-tb__sep" />
      <Btn editor={editor} label="H1" title="Heading 1" isActive={editor.isActive("heading", { level: 1 })} run={() => c().toggleHeading({ level: 1 }).run()} />
      <Btn editor={editor} label="H2" title="Heading 2" isActive={editor.isActive("heading", { level: 2 })} run={() => c().toggleHeading({ level: 2 }).run()} />
      <Btn editor={editor} label="•" title="Bullet list" isActive={editor.isActive("bulletList")} run={() => c().toggleBulletList().run()} />
      <Btn editor={editor} label="1." title="Ordered list" isActive={editor.isActive("orderedList")} run={() => c().toggleOrderedList().run()} />
      <Btn editor={editor} label="❝" title="Quote" isActive={editor.isActive("blockquote")} run={() => c().toggleBlockquote().run()} />
      <span className="lmd-tb__sep" />
      <Btn editor={editor} label="⚓ anchor" title="Insert lmd anchor" run={insertAnchor} />
      <Btn editor={editor} label="🔗 link" title="Insert lmd link" run={insertRef} />
    </div>
  );
}

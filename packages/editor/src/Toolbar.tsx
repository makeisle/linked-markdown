/** A minimal formatting toolbar for {@link LmdEditor}. */

import type { Editor } from "@tiptap/react";
import * as React from "react";
import { useRef, useState } from "react";

function Btn({
  label,
  title,
  isActive,
  run,
}: {
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

/** Normalize free text into a valid lmd slug (`[a-z][a-z0-9-]*`). */
function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z]/.test(s) ? s : `a-${s}`;
}

type Prompt = "anchor" | "link";

export function Toolbar({ editor }: { editor: Editor | null }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  // Uncontrolled input: read the value from the DOM on submit. Avoids React
  // controlled-input pitfalls (and works with programmatic fills).
  const inputRef = useRef<HTMLInputElement>(null);
  if (!editor) return null;
  const c = () => editor.chain().focus();

  function submit() {
    const v = inputRef.current?.value.trim() ?? "";
    if (v && prompt) {
      if (prompt === "anchor") {
        c().insertContent({ type: "lmd_comment", attrs: { raw: `<!--lmd:a ${slugify(v)}-->` } }).run();
      } else {
        // Accept "text|target" or just a target (used as its own text).
        const [a, b] = v.split("|").map((s) => s.trim());
        const target = b ? b : a;
        const text = b ? a : a;
        c().insertContent(`[${text}](${target})`).run();
      }
    }
    setPrompt(null);
  }

  function toggle(kind: Prompt) {
    setPrompt((p) => (p === kind ? null : kind));
  }

  return (
    <div className="lmd-tb">
      <div className="lmd-tb__row">
        <Btn label="B" title="Bold" isActive={editor.isActive("bold")} run={() => c().toggleBold().run()} />
        <Btn label="I" title="Italic" isActive={editor.isActive("italic")} run={() => c().toggleItalic().run()} />
        <Btn label="‹›" title="Code" isActive={editor.isActive("code")} run={() => c().toggleCode().run()} />
        <span className="lmd-tb__sep" />
        <Btn label="H1" title="Heading 1" isActive={editor.isActive("heading", { level: 1 })} run={() => c().toggleHeading({ level: 1 }).run()} />
        <Btn label="H2" title="Heading 2" isActive={editor.isActive("heading", { level: 2 })} run={() => c().toggleHeading({ level: 2 }).run()} />
        <Btn label="•" title="Bullet list" isActive={editor.isActive("bulletList")} run={() => c().toggleBulletList().run()} />
        <Btn label="1." title="Ordered list" isActive={editor.isActive("orderedList")} run={() => c().toggleOrderedList().run()} />
        <Btn label="❝" title="Quote" isActive={editor.isActive("blockquote")} run={() => c().toggleBlockquote().run()} />
        <span className="lmd-tb__sep" />
        <Btn label="⚓ anchor" title="Insert lmd anchor" isActive={prompt === "anchor"} run={() => toggle("anchor")} />
        <Btn label="🔗 link" title="Insert lmd link" isActive={prompt === "link"} run={() => toggle("link")} />
      </div>

      {prompt && (
        <div className="lmd-tb__prompt">
          <input
            key={prompt}
            ref={inputRef}
            autoFocus
            defaultValue=""
            className="lmd-tb__input"
            placeholder={prompt === "anchor" ? "anchor slug (e.g. my-section)" : "target (e.g. :my-section) — or text|target"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                setPrompt(null);
              }
            }}
          />
          <button type="button" className="lmd-tb__btn" onMouseDown={(e) => e.preventDefault()} onClick={submit}>
            Insert
          </button>
          <button type="button" className="lmd-tb__btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPrompt(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

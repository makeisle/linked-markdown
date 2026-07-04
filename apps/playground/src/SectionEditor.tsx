import * as React from "react";
import { useMemo, useRef, useState } from "react";

export interface AnchorOption {
  slug: string;
  title: string;
}

const RELS = [
  "related",
  "parent",
  "child",
  "impacts",
  "impacted_by",
  "invariant",
  "policy",
  "source",
  "see_also",
];

interface Pick {
  slug: string;
  rel: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// The escape scaffolding (delimiters, keywords, roles, `=`, `,`) is "punct"
// (sand); the meaningful identifiers — anchor names and target addresses — are
// "name" (teal). Source text between a ref's tags stays plain.
const punct = (s: string) => `<span class="hl-punct">${esc(s)}</span>`;
const name = (s: string) => `<span class="hl-name">${esc(s)}</span>`;

function hlTargets(s: string): string {
  return s.replace(
    /(\s+)|([a-z_]+=)|(,)|([:#]?[a-z][a-z0-9-]*(?::[a-z0-9-]+)?(?:@[\w.]+)?)/g,
    (m, ws, role, comma, addr) => {
      if (ws) return ws;
      if (role) return punct(role);
      if (comma) return punct(comma);
      if (addr) return name(addr);
      return esc(m);
    },
  );
}

function hlComment(text: string): string {
  let m = text.match(/^(<!--lmd:a\s+)([a-z][a-z0-9-]*)(\s+rev=\d+)?(\s*-->)$/);
  if (m) return punct(m[1]) + name(m[2]) + punct(m[3] ?? "") + punct(m[4]);
  m = text.match(/^(<!--lmd:ref\s+)([\s\S]*?)(\s*-->)$/);
  if (m) return punct(m[1]) + hlTargets(m[2]) + punct(m[3]);
  return punct(text); // ref close <!--/lmd-->
}

const RE_TOKEN = /<!--lmd:a\s+[a-z][a-z0-9-]*(?:\s+rev=\d+)?\s*-->|<!--lmd:ref\s+[\s\S]*?-->|<!--\s*\/lmd\s*-->/g;
function highlight(text: string): string {
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  RE_TOKEN.lastIndex = 0;
  while ((m = RE_TOKEN.exec(text))) {
    out += esc(text.slice(last, m.index));
    out += hlComment(m[0]);
    last = m.index + m[0].length;
  }
  out += esc(text.slice(last));
  return out + "\n"; // trailing newline keeps the backdrop height in sync
}

/**
 * A plain raw-Markdown editor for one section. The only thing beyond a textarea
 * is the connection composer: typing `@` opens a search UI to pick one or more
 * target anchors, each with its own relationship type, and inserts the raw lmd
 * comment (`<!--lmd:rel type=:a,:b … -->`) at the cursor.
 */
export function SectionEditor({
  initial,
  anchors,
  onSave,
  onCancel,
}: {
  initial: string;
  anchors: AnchorOption[];
  onSave: (md: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [composer, setComposer] = useState<{ at: number } | null>(null);
  const [query, setQuery] = useState("");
  const [picks, setPicks] = useState<Pick[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    const val = el.value;
    const caret = el.selectionStart;
    // A single `@` was just typed → open the composer and strip the `@`.
    if (val.length === draft.length + 1 && val[caret - 1] === "@") {
      const at = caret - 1;
      setDraft(val.slice(0, at) + val.slice(at + 1));
      setPicks([]);
      setQuery("");
      setComposer({ at });
      return;
    }
    setDraft(val);
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return anchors
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.slug.includes(q))
      .slice(0, 8);
  }, [anchors, query]);

  function togglePick(slug: string) {
    setPicks((p) => (p.some((x) => x.slug === slug) ? p.filter((x) => x.slug !== slug) : [...p, { slug, rel: "related" }]));
  }
  function setRel(slug: string, rel: string) {
    setPicks((p) => p.map((x) => (x.slug === slug ? { ...x, rel } : x)));
  }

  function insert() {
    if (!composer || picks.length === 0) {
      setComposer(null);
      return;
    }
    // Group targets by relationship type: `role1=:a,:b role2=:c`.
    const byRel = new Map<string, string[]>();
    for (const p of picks) {
      const list = byRel.get(p.rel) ?? [];
      list.push(`:${p.slug}`);
      byRel.set(p.rel, list);
    }
    const targets = [...byRel].map(([r, ts]) => `${r}=${ts.join(",")}`).join(" ");
    // Wrap a source span: <!--lmd:ref targets-->text<!--/lmd-->. Insert a "link"
    // placeholder and select it so the user types the source text over it.
    const open = `<!--lmd:ref ${targets}-->`;
    const placeholder = "link";
    const raw = `${open}${placeholder}<!--/lmd-->`;
    const at = composer.at;
    setDraft(draft.slice(0, at) + raw + draft.slice(at));
    setComposer(null);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.selectionStart = at + open.length;
        el.selectionEnd = at + open.length + placeholder.length;
      }
    });
  }

  return (
    <div className="editor">
      <div className="editor__bar">
        <span className="editor__label">Editing — raw Markdown</span>
        <span className="editor__hint">
          type <kbd>@</kbd> to link
        </span>
        <span className="editor__spacer" />
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}>
          Save
        </button>
      </div>

      <div className="editor__area">
        <div className="editor__hl" ref={hlRef} aria-hidden dangerouslySetInnerHTML={{ __html: highlight(draft) }} />
        <textarea
          ref={taRef}
          className="editor__ta"
          value={draft}
          spellCheck={false}
          onChange={onChange}
          onScroll={(e) => {
            const hl = hlRef.current;
            if (hl) {
              hl.scrollTop = e.currentTarget.scrollTop;
              hl.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && composer) {
              e.preventDefault();
              setComposer(null);
            }
          }}
        />

        {composer && (
          <div className="composer">
            <div className="composer__head">
              <span>Add connections</span>
              <button className="composer__x" onClick={() => setComposer(null)}>
                ✕
              </button>
            </div>
            <input
              autoFocus
              className="composer__search"
              placeholder="Search anchors…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="composer__results">
              {results.map((a) => {
                const on = picks.some((p) => p.slug === a.slug);
                return (
                  <li key={a.slug}>
                    <button className={`composer__opt${on ? " is-on" : ""}`} onClick={() => togglePick(a.slug)}>
                      <span className="composer__check">{on ? "✓" : "+"}</span>
                      <span className="composer__optTitle">{a.title}</span>
                      <span className="composer__optSlug">:{a.slug}</span>
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && <li className="composer__none">no matches</li>}
            </ul>

            {picks.length > 0 && (
              <div className="composer__picks">
                {picks.map((p) => (
                  <div key={p.slug} className="composer__pick">
                    <span className="composer__pickSlug">:{p.slug}</span>
                    <select value={p.rel} onChange={(e) => setRel(p.slug, e.target.value)}>
                      {RELS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button className="composer__rm" onClick={() => togglePick(p.slug)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="composer__foot">
              <span className="composer__count">{picks.length} selected</span>
              <button className="btn btn--primary" disabled={picks.length === 0} onClick={insert}>
                Insert
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import * as core from "@lmd/core";
import { LmdEditor } from "@lmd/editor";
import { renderToHtml } from "@lmd/viewer";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
// Vite resolves the generated wasm binary to a URL we hand to the core init.
import wasmUrl from "@lmd/core/pkg/lmd_wasm_bg.wasm?url";

const FRONTMATTER = [
  "---",
  "lmd: 1",
  "id: 0192f3a1-7c2e-7b3d-9f10-aa01play00001",
  "version: 1",
  "title: Playground document",
  "imports:",
  "  design: { id: 0192f3a1-7c2e-7b3d-9f10-aa01design001, pin: \"@1\" }",
  "---",
].join("\n");

const INITIAL_BODY = [
  "# Welcome to Linked Markdown <!--lmd:a intro-->",
  "",
  "Edit on the left. The document is built by the Rust core (via WebAssembly) and",
  "rendered with its link-graph overlay on the right.",
  "",
  "## Anchors and links <!--lmd:a anchors-->",
  "",
  "This sentence links back to [the intro](:intro)<!--lmd:ref rel=related-->.",
  "<!--lmd:rel impacts=design:uc-join-->",
].join("\n");

export function App() {
  const [ready, setReady] = useState(false);
  const [body, setBody] = useState(INITIAL_BODY);
  const [doc, setDoc] = useState<core.Doc | null>(null);
  const [diags, setDiags] = useState<core.Diagnostic[]>([]);

  useEffect(() => {
    core.init(wasmUrl).then(() => setReady(true)).catch((e) => setDiags([err(String(e))]));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const src = `${FRONTMATTER}\n\n${body}\n`;
    let cancelled = false;
    (async () => {
      try {
        const [built, checked] = await Promise.all([core.build(src), core.check(src)]);
        if (!cancelled) {
          setDoc(built);
          setDiags(checked);
        }
      } catch (e) {
        if (!cancelled) setDiags([err(String(e))]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, body]);

  const rendered = useMemo(() => (doc ? renderToHtml(doc) : null), [doc]);
  const errors = diags.filter((d) => d.severity === "error");

  return (
    <div className="app">
      <header className="app__head">
        <h1>Linked Markdown</h1>
        <span className="app__sub">live editor · Rust/wasm core · graph-aware viewer</span>
      </header>

      <main className="panes">
        <section className="pane">
          <h2 className="pane__title">Editor</h2>
          <LmdEditor value={INITIAL_BODY} onChange={setBody} />
        </section>

        <section className="pane">
          <h2 className="pane__title">Rendered</h2>
          {rendered ? (
            // The viewer output is sanitized markdown-it HTML for our own content.
            <div className="rendered" dangerouslySetInnerHTML={{ __html: rendered.html }} />
          ) : (
            <p className="muted">{ready ? "Building…" : "Loading core…"}</p>
          )}
          {rendered && Object.keys(rendered.backlinks).length > 0 && (
            <div className="backlinks">
              <h3>Backlinks</h3>
              <ul>
                {Object.entries(rendered.backlinks).map(([slug, links]) => (
                  <li key={slug}>
                    <code>:{slug}</code> ←{" "}
                    {links.map((l, i) => (
                      <span key={i} className="tag">
                        {l.from} <em>{l.rel}</em>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="pane">
          <h2 className="pane__title">Diagnostics & manifest</h2>
          <div className={`diags${errors.length ? " has-errors" : ""}`}>
            {diags.length === 0 ? (
              <p className="ok">✓ no problems</p>
            ) : (
              <ul>
                {diags.map((d, i) => (
                  <li key={i} className={`diag diag--${d.severity}`}>
                    <strong>{d.severity}</strong> <code>{d.code}</code> {d.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {doc?.manifest && (
            <pre className="manifest">{JSON.stringify(doc.manifest, null, 2)}</pre>
          )}
        </section>
      </main>
    </div>
  );
}

function err(message: string): core.Diagnostic {
  return { severity: "error", code: "runtime", message };
}

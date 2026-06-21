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
  const nodeCount = doc?.manifest ? Object.keys(doc.manifest.nodes).length : 0;
  const edgeCount = doc?.manifest ? doc.manifest.edges.length : 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ⬡
          </span>
          <span className="brand__name">Linked Markdown</span>
          <span className="brand__tag">playground</span>
        </div>
        <div className="stats">
          <span className="stat">
            <b>{nodeCount}</b> nodes
          </span>
          <span className="stat">
            <b>{edgeCount}</b> edges
          </span>
          <span className={`pill ${errors.length ? "pill--bad" : "pill--ok"}`}>
            {errors.length ? `${errors.length} error${errors.length > 1 ? "s" : ""}` : "valid"}
          </span>
        </div>
      </header>

      <main className="panes">
        <section className="pane">
          <div className="pane__head">
            <span className="pane__title">Editor</span>
            <span className="pane__hint">WYSIWYG · escape comments as chips</span>
          </div>
          <div className="pane__body">
            <LmdEditor value={INITIAL_BODY} onChange={setBody} />
          </div>
        </section>

        <section className="pane">
          <div className="pane__head">
            <span className="pane__title">Rendered</span>
            <span className="pane__hint">clean Markdown + link graph</span>
          </div>
          <div className="pane__body">
            {rendered ? (
              <article className="rendered" dangerouslySetInnerHTML={{ __html: rendered.html }} />
            ) : (
              <p className="muted">{ready ? "Building…" : "Loading core…"}</p>
            )}
            {rendered && Object.keys(rendered.backlinks).length > 0 && (
              <div className="backlinks">
                <h3>Backlinks</h3>
                <ul>
                  {Object.entries(rendered.backlinks).map(([slug, links]) => (
                    <li key={slug}>
                      <code>:{slug}</code>
                      <span className="backlinks__arrow">←</span>
                      {links.map((l, i) => (
                        <span key={i} className="tag">
                          {l.from}
                          <em>{l.rel}</em>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="pane pane--aside">
          <div className="pane__head">
            <span className="pane__title">Diagnostics</span>
            <span className="pane__hint">manifest is machine-managed</span>
          </div>
          <div className="pane__body">
            <div className={`diags${errors.length ? " has-errors" : ""}`}>
              {diags.length === 0 ? (
                <p className="ok">✓ no problems</p>
              ) : (
                <ul>
                  {diags.map((d, i) => (
                    <li key={i} className={`diag diag--${d.severity}`}>
                      <span className="diag__dot" />
                      <code>{d.code}</code>
                      <span className="diag__msg">{d.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {doc?.manifest && (
              <details className="manifest" open>
                <summary>manifest.json</summary>
                <pre>{JSON.stringify(doc.manifest, null, 2)}</pre>
              </details>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function err(message: string): core.Diagnostic {
  return { severity: "error", code: "runtime", message };
}

/**
 * VS Code extension entry point for Linked Markdown.
 *
 * Registers the `.lmd` language (grammar contributed in package.json) and starts
 * the `@lmd/lsp` language server, which provides diagnostics, completion,
 * go-to-definition, references, symbols, and hover.
 */

import type { ExtensionContext } from "vscode";
import { LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export function activate(_context: ExtensionContext): void {
  // CommonJS extension host: `require.resolve` is available directly.
  const serverModule = require.resolve("@lmd/lsp/dist/cli.js");

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "lmd" }],
  };

  client = new LanguageClient("lmd", "Linked Markdown", serverOptions, clientOptions);
  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}

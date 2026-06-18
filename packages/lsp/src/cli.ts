#!/usr/bin/env node
/** Entry point: run the Linked Markdown language server over stdio. */

import { createConnection, ProposedFeatures } from "vscode-languageserver/node.js";
import { createServer } from "./server.js";

createServer(createConnection(ProposedFeatures.all));

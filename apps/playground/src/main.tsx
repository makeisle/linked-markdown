import * as React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

// Note: no React.StrictMode — TipTap's React node views call flushSync, which
// StrictMode's double-invocation turns into noisy warnings and renderer churn.
createRoot(document.getElementById("root")!).render(<App />);

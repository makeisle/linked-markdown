import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // The wasm glue uses top-level dynamic import + `new URL(...)`; keep esbuild
  // from pre-bundling @lmd/core so the wasm asset is resolved by Vite directly.
  optimizeDeps: { exclude: ["@lmd/core"] },
});

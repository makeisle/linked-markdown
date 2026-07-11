import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // `/` for local dev and CI. The Pages workflow sets BASE_URL=/linked-markdown/play/
  // so the built demo sits under the docs site.
  base: process.env.BASE_URL ?? "/",
  plugins: [react()],
  // The wasm glue uses top-level dynamic import + `new URL(...)`; keep esbuild
  // from pre-bundling @lmd/core so the wasm asset is resolved by Vite directly.
  optimizeDeps: { exclude: ["@lmd/core"] },
  build: {
    rollupOptions: {
      output: {
        // Split the heavy editor stack and React into their own vendor chunks so
        // the app shell stays small.
        manualChunks(id) {
          if (id.includes("node_modules/@tiptap") || id.includes("node_modules/prosemirror")) {
            return "editor-vendor";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
});

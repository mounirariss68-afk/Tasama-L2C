/**
 * Standalone build — ONE self-contained .html file, no server.
 *
 * The normal `npm run build` emits a dist/ that has to be served (absolute
 * /assets/… paths, separate CSS, fonts and brand art). That is right for a
 * deployment and wrong for the two ways this demo actually travels: a file
 * you double-click, and a hosted page with its own link.
 *
 * So: relative base, no code splitting, no CSS split, and an inline limit
 * high enough that every font and image becomes a data: URI. What is left
 * over — one JS file, one CSS file, and the /brand/* art that lives in
 * public/ and so is never touched by the bundler — is folded into the HTML
 * by tools/bundle-standalone.mjs.
 *
 * iife, not esm: an inline <script type="module"> is not reliably allowed
 * from file://, and this file has to open by double-clicking.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ["react", "react-dom"] },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist-standalone"),
    // Overwrite rather than wipe. The output names are fixed (app.js, app.css,
    // index.html) so nothing goes stale, and emptying the directory needs a
    // delete permission this project should not require for a build.
    emptyOutDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    rollupOptions: {
      output: { format: "iife", inlineDynamicImports: true, entryFileNames: "app.js", assetFileNames: "app.[ext]" },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? 5174);
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: { port, strictPort: true, host: "0.0.0.0", allowedHosts: true },
  preview: { port, host: "0.0.0.0", allowedHosts: true },
  resolve: {
    // The design system ships .tsx source; dedupe React so hooks resolve once.
    dedupe: ["react", "react-dom"],
  },
  build: { outDir: path.resolve(import.meta.dirname, "dist"), emptyOutDir: true },
});

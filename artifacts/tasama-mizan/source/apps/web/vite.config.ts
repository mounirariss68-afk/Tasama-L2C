import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: Number(process.env.PORT ?? 5174), host: "0.0.0.0" },
  preview: { port: Number(process.env.PORT ?? 5174), host: "0.0.0.0" },
  resolve: {
    // The design system ships .tsx source; dedupe React so hooks resolve once.
    dedupe: ["react", "react-dom"],
  },
  build: { outDir: path.resolve(import.meta.dirname, "dist"), emptyOutDir: true },
});

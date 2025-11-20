import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: "../build",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "main.tsx"),
      output: {
        entryFileNames: "assets/main.js",
        inlineDynamicImports: false,
        format: "iife",
        manualChunks: () => "single-bundle",
      },
    },
  },
});

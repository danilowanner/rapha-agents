import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "../dist"),
  },
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      srcDirectory: ".",
    }),
    viteReact(),
  ],
});

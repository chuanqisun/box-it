import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/box-it/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        tracker: resolve(__dirname, "object-tracking-visualizer.html"),
      },
    },
  },
});

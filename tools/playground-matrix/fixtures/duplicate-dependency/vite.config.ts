import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Keep the dynamic bridge import in its own chunk so the copies are
    // countable rather than merged into one file.
    rollupOptions: { output: { manualChunks: undefined } },
  },
});

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Keep the dynamic bridge imports in their own chunks so the copies stay
    // countable rather than merged into one file.
    rollupOptions: { output: { manualChunks: undefined } },
  },
});

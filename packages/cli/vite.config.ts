import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      "config/index": "./src/entrypoints/config.ts",
    },
    format: ["esm"],
    outDir: "./dist",
    sourcemap: true,
    clean: true,
    dts: true,
  },
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
    env: {
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  },
});

import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      "field-plugins/index": "./src/field-plugins/index.ts",
    },
    format: ["esm", "cjs"],
    outDir: "./dist",
    sourcemap: true,
    clean: true,
    dts: true,
    attw: true,
    exports: true,
    publint: true,
    unbundle: true,
  },
  test: {
    environment: "node",
    typecheck: {
      enabled: true,
    },
  },
});

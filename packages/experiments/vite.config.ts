import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      adapters: "./src/adapters.ts",
    },
    format: ["esm", "cjs"],
    sourcemap: true,
    dts: true,
    attw: true,
    exports: true,
    publint: true,
  },
  test: {
    environment: "node",
  },
});

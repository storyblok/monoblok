import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm", "cjs"],
    outDir: "./dist",
    sourcemap: true,
    clean: true,
    dts: true,
    attw: true,
    exports: true,
    publint: true,
  },
});

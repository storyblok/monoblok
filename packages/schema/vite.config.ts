import { defineConfig } from "vite-plus";
import { cjsInterop } from "../../tools/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      "field-plugins/index": "./src/field-plugins/index.ts",
      "migrations/index": "./src/migrations/index.ts",
    },
    format: ["esm", "cjs"],
    plugins: [cjsInterop()],
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

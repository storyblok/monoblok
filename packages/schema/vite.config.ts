import { defineConfig } from "vite-plus";
import { cjsDeprecation } from "../../tools/cjs/cjs-deprecation-plugin.ts";
import { cjsInterop } from "../../tools/cjs/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      "field-plugins/index": "./src/field-plugins/index.ts",
    },
    format: ["esm", "cjs"],
    plugins: [cjsInterop(), cjsDeprecation()],
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

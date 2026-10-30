import { defineConfig } from "vite-plus";
import { cjsDeprecation } from "../../tools/cjs/cjs-deprecation-plugin.ts";
import { cjsInterop } from "../../tools/cjs/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      adapters: "./src/adapters.ts",
    },
    format: ["esm", "cjs"],
    plugins: [cjsInterop(), cjsDeprecation()],
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

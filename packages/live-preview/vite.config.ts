import { defineConfig } from "vite-plus";
import { cjsDeprecation } from "../../tools/cjs/cjs-deprecation-plugin.ts";
import { cjsInterop } from "../../tools/cjs/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    format: ["esm", "cjs"],
    plugins: [cjsInterop(), cjsDeprecation()],
    exports: true,
    sourcemap: true,
    dts: true,
    unbundle: true,
    attw: true,
    publint: true,
  },
  test: {
    environment: "jsdom",
  },
});

import { defineConfig } from "vite-plus";
import { cjsInterop } from "../../tools/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    format: ["esm", "cjs"],
    plugins: [cjsInterop()],
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

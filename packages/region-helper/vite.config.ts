import { defineConfig } from "vite-plus";
import { cjsDeprecation } from "../../tools/cjs/cjs-deprecation-plugin.ts";
import { cjsInterop } from "../../tools/cjs/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm", "cjs"],
    plugins: [cjsInterop(), cjsDeprecation()],
    outDir: "./dist",
    sourcemap: true,
    clean: true,
    dts: true,
    attw: true,
    exports: true,
    publint: true,
  },
});

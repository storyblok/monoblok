import { defineConfig } from "vite-plus";
import { cjsDeprecation } from "../../tools/cjs/cjs-deprecation-plugin.ts";
import { cjsInterop } from "../../tools/cjs/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm", "cjs"],
    plugins: [cjsInterop(), cjsDeprecation()],
    exports: true,
    sourcemap: true,
    dts: true,
    attw: { profile: "node16" },
    publint: true,
  },
  test: {
    environment: "jsdom",
    include: ["./src/**/*.test.ts"],
  },
});

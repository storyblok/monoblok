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
    // Ship the API reference in the tarball so coding agents can read it from
    // node_modules/@storyblok/live-preview/dist/docs/.
    copy: [{ from: "docs", to: "dist", flatten: false }],
  },
  test: {
    environment: "jsdom",
  },
});

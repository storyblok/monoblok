import { defineConfig } from "vite-plus";
import { cjsInterop } from "../../tools/cjs-interop-plugin.ts";

export default defineConfig({
  pack: {
    entry: ["./src/index.ts"],
    format: ["cjs", "esm", "umd"],
    plugins: [cjsInterop()],
    globalName: "StoryblokJSClient",
    outDir: "./dist",
    sourcemap: true,
    clean: true,
    dts: true,
    attw: true,
    exports: true,
    publint: true,
  },
});

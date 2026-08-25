import { defineConfig } from "vite-plus";
import Vue from "unplugin-vue/rolldown";

import pkg from "./package.json" with { type: "json" };

const banner = `/**\n * name: ${pkg.name}\n * (c) ${new Date().getFullYear()}\n * description: ${pkg.description}\n * author: ${pkg.author}\n */`;

export default defineConfig({
  pack: [
    {
      // Scoped to the module entry: `./vue.css` is a stylesheet, so it has no
      // TypeScript resolution for attw to check.
      attw: { entrypoints: ["."], level: "error", profile: "node16" },
      banner,
      // Scoped styles from FallbackComponent.vue are extracted, not injected,
      // which is how this package has always shipped them.
      css: { fileName: "vue.css" },
      // Declarations come from vue-tsc so that `.vue` imports resolve.
      dts: { vue: true },
      entry: { index: "./src/index.ts" },
      format: ["esm", "cjs"],
      outDir: "./dist",
      plugins: [Vue({ isProduction: true })],
      publint: true,
    },
  ],
});

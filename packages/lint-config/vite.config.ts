import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      base: "./src/base.ts",
      vue: "./src/vue.ts",
      svelte: "./src/svelte.ts",
      astro: "./src/astro.ts",
      nuxt: "./src/nuxt.ts",
    },
    format: "esm",
    dts: true,
    clean: true,
    outDir: "./dist",
    external: ["oxlint"],
  },
});

import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type PluginOption } from "vite";
import { resolve } from "pathe";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [sveltekit(), mkcert()] as PluginOption[],
  resolve: {
    alias: {
      "@storyblok/svelte": resolve(import.meta.dirname, "../../src/lib/index.ts"),
    },
  },
});

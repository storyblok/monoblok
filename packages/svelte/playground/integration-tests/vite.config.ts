import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type PluginOption } from "vite";
import { resolve } from "pathe";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  define: {
    "import.meta.env.STORYBLOK_PREVIEW_TOKEN": JSON.stringify(process.env.STORYBLOK_PREVIEW_TOKEN),
  },
  plugins: [sveltekit(), basicSsl()] as PluginOption[],
  resolve: {
    alias: {
      "@storyblok/svelte": resolve(import.meta.dirname, "../../src/lib/index.ts"),
    },
  },
});

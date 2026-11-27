import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { resolve } from "pathe";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  // Kit 3 looks for a legacy `svelte.config.js` in the root, which defaults to the cwd. Tools that load
  // this config from the package directory would find the package's own `svelte.config.js`.
  root: import.meta.dirname,
  plugins: [sveltekit({ adapter: adapter() }), basicSsl()],
  resolve: {
    alias: {
      "@storyblok/svelte": resolve(import.meta.dirname, "../../src/lib/index.ts"),
    },
  },
});

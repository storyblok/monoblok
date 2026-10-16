import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";

export default defineConfig({
  // The toolbar's dynamic import loses the race against Vite re-optimizing
  // dependencies, and the e2e suite fails a test on any unhandled rejection.
  devToolbar: { enabled: !process.env.STORYBLOK_E2E },
  integrations: [react()],
  // Output stays `static` (the default): only `on-demand-preview.astro`
  // opts out with `export const prerender = false`. The adapter isn't
  // needed in dev (Astro always renders on demand there), but `astro
  // build` requires one for any on-demand route.
  adapter: node({ mode: "standalone" }),
});

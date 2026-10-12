import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// Output stays `static` (the default): `prerendered-preview.astro` keeps
// prerendering, and the adapter only exists so `on-demand-preview.astro`
// can opt out with `export const prerender = false`.
export default defineConfig({
  adapter: node({ mode: "standalone" }),
});

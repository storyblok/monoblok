import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import mkcert from "vite-plugin-mkcert";

// Purpose-built for integration-style regression scenarios that don't belong
// in the `ssr` playground's demo-site content (e.g. client-directive hydration
// across a live-preview DOM morph). Keep it minimal: add a scenario, a block,
// a story — not a realistic site.
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [mkcert()],
  },
  output: "server",
  adapter: node({ mode: "standalone" }),
});

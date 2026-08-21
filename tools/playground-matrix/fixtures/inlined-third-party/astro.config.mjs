import { defineConfig } from "astro/config";
import { storyblok } from "@storyblok/astro";
import node from "@astrojs/node";

// `livePreview` is what pulls the integration's client-side code — and with it
// its copy of `morphdom` — into the page bundle.
export default defineConfig({
  integrations: [
    storyblok({
      accessToken: "fixture-token",
      componentsDir: "src",
      livePreview: true,
      bridge: false,
    }),
  ],
  output: "server",
  adapter: node({ mode: "standalone" }),
});

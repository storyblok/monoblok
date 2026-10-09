import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  // The toolbar's dynamic import loses the race against Vite re-optimizing
  // dependencies, and the e2e suite fails a test on any unhandled rejection.
  devToolbar: { enabled: !process.env.STORYBLOK_E2E },
  integrations: [react()],
});

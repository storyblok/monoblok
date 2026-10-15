import type { SmokeConfig } from "../src/config.ts";

export default {
  build: "npm run build",
  start: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
  // vite-plugin-mkcert makes the preview HTTPS.
  url: "https://127.0.0.1:4173/",
  // `use:storyblokEditable` only runs in the browser, after hydration.
  ready: () => document.querySelector(".teaser[data-blok-uid]") !== null,
  expect: ["Hello world!", "Feature 1", "Feature 2", "Feature 3"],
} satisfies SmokeConfig;

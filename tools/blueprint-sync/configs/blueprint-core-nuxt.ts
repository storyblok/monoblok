import type { SmokeConfig } from "../src/config.ts";

export default {
  build: "npm run build",
  start: "npm run preview -- --host 127.0.0.1 --port 3000",
  url: "http://127.0.0.1:3000/",
  // `v-editable` only runs in the browser, after hydration.
  ready: () => document.querySelector(".teaser[data-blok-uid]") !== null,
  expect: ["Hello world!", "Feature 1", "Feature 2", "Feature 3"],
} satisfies SmokeConfig;

import type { SmokeConfig } from "../src/config.ts";

export default {
  build: "npm run build",
  // The host is an env var because older Nuxt CLIs (the workspace lockfile has 3.37) take no
  // `--host` and read it as the project folder.
  start: "HOST=127.0.0.1 npm run preview -- --port 3000",
  url: "http://127.0.0.1:3000/",
  // `v-editable` only runs in the browser, after hydration.
  ready: () => document.querySelector(".teaser[data-blok-uid]") !== null,
  serverRendered: true,
  expect: ["Hello world!", "Feature 1", "Feature 2", "Feature 3"],
} satisfies SmokeConfig;

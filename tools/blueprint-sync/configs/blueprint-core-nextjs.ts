import type { SmokeConfig } from "../src/config.ts";

export default {
  build: "npm run build",
  start: "npm start -- --hostname 127.0.0.1 --port 3000",
  url: "http://127.0.0.1:3000/",
  // React sets `__reactFiber$…` on the elements it hydrated.
  ready: () =>
    [...document.querySelectorAll("h1")].some(
      (element) =>
        element.textContent === "Hello world!" &&
        Object.keys(element).some((key) => key.startsWith("__reactFiber$")),
    ),
  serverRendered: true,
  expect: ["Hello world!", "Feature 1", "Feature 2", "Feature 3"],
} satisfies SmokeConfig;

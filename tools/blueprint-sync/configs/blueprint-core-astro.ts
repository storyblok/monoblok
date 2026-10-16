import type { SmokeConfig } from "../src/config.ts";

export default {
  build: "npm run build",
  // The Vercel adapter has no `astro preview`, so this serves with `astro dev`; the build above
  // still has to pass. `--ignore-lock` keeps it in the foreground when a coding agent runs it.
  start: "npm run dev -- --host 127.0.0.1 --port 4321 --ignore-lock",
  url: "https://127.0.0.1:4321/",
  expect: ["Hello world!", "Feature 1", "Feature 2", "Feature 3"],
} satisfies SmokeConfig;

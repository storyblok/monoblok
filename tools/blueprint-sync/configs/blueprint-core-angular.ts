import { readFileSync, writeFileSync } from "node:fs";
import { join } from "pathe";

import type { SmokeConfig } from "../src/config.ts";

const writes = ["src/environments/environment.ts", "src/environments/environment.development.ts"];

export default {
  // Angular has no .env: `storyblok create` writes the token into the environment files by
  // replacing these placeholders (see the CLI's `updateAngularEnvironmentFiles`).
  beforeBuild: (projectDir) => {
    for (const file of writes) {
      const path = join(projectDir, file);
      const content = readFileSync(path, "utf8")
        .replaceAll("STORYBLOK_DELIVERY_API_TOKEN", process.env.STORYBLOK_DELIVERY_API_TOKEN ?? "")
        .replaceAll("STORYBLOK_REGION", "eu");
      writeFileSync(path, content);
    }
  },
  writes,
  build: "npm run build",
  start: "PORT=4000 npm run serve:ssr:my-storyblok-app",
  url: "http://localhost:4000/",
  // Not `serverRendered: true` yet: `ng build` prerenders 0 routes and, with `allowedHosts: []`, the
  // server falls back to the client-rendered shell, so the texts are not in the HTML. Set it once
  // the blueprint server-renders.
  expect: ["Hello world!", "Feature 1", "Feature 2", "Feature 3"],
} satisfies SmokeConfig;

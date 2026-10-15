import { readFileSync, writeFileSync } from "node:fs";
import { join } from "pathe";

import type { SmokeConfig } from "../src/config.ts";

export default {
  // Angular has no .env: `storyblok create` writes the token into the environment files by
  // replacing these placeholders (see the CLI's `updateAngularEnvironmentFiles`).
  beforeBuild: (projectDir) => {
    for (const file of ["environment.ts", "environment.development.ts"]) {
      const path = join(projectDir, "src/environments", file);
      const content = readFileSync(path, "utf8")
        .replaceAll("STORYBLOK_DELIVERY_API_TOKEN", process.env.STORYBLOK_DELIVERY_API_TOKEN ?? "")
        .replaceAll("STORYBLOK_REGION", "eu");
      writeFileSync(path, content);
    }
  },
  build: "npm run build",
  start: "PORT=4000 npm run serve:ssr:my-storyblok-app",
  url: "http://localhost:4000/",
  expect: ["Hello world!", "Feature 1", "Feature 2", "Feature 3"],
} satisfies SmokeConfig;

/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";
import { storyblok } from "./src/index";

export default getViteConfig(
  {
    test: {
      // Only the unit tests. `test/visual-editor` holds Playwright specs for
      // manual QA against a real space: Vitest's default `**/*.spec.ts` pattern
      // otherwise collects them, and importing one throws on the missing
      // STORYBLOK_SPACE_ID that only a QA run exports.
      include: ["tests/**/*.test.ts"],
    },
  },
  {
    integrations: [
      storyblok({
        accessToken: "",
      }),
    ],
  },
);

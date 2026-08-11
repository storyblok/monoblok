import { defineConfig } from "oxlint";
import { base } from "@storyblok/lint-config";

export default defineConfig({
  extends: [base],
  // The expected-types fixture must stay byte-identical to `renderSchemaTypes`'s
  // actual output, which the drift test in `fixture-drift.test.ts` compares it
  // against; linting or formatting it would push it out of sync with the renderer.
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "coverage/",
    "src/commands/types/generate/schema-types/__fixtures__/expected-types.d.ts",
  ],
});

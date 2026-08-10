import { defineConfig } from "oxlint";
import { astro } from "@storyblok/lint-config";

export default defineConfig({
  extends: [astro],
  ignorePatterns: ["node_modules/", ".storyblok/", "dist/", ".astro/"],
  overrides: [
    {
      files: ["src/seeds/**/*.ts"],
      rules: {
        "eslint/no-console": ["error", { allow: ["warn", "error", "info"] }],
      },
    },
  ],
});

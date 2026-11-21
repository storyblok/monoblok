import { defineConfig } from "oxlint";
import { base } from "@storyblok/lint-config";

export default defineConfig({
  extends: [base],
  ignorePatterns: [".axis/", ".cache/", "arms/", "node_modules/"],
});

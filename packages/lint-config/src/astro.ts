import { defineConfig } from "oxlint";
import base from "./base";

/**
 * Storyblok Astro preset.
 *
 * Oxlint does not yet ship an `astro` plugin. This preset re-exports the
 * base ruleset so consumers have a stable subpath; once Oxlint gains
 * Astro rules, add them here.
 */
export default defineConfig({
  extends: [base],
  rules: {},
});

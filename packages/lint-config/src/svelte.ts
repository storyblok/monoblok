import { defineConfig } from "oxlint";
import base from "./base";

/**
 * Storyblok Svelte preset.
 *
 * Oxlint does not yet ship a `svelte` plugin. This preset re-exports the
 * base ruleset so consumers have a stable subpath; once Oxlint gains
 * Svelte rules, add them here.
 */
export default defineConfig({
  extends: [base],
  rules: {},
});

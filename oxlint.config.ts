import { defineConfig } from "oxlint";
import { base } from "@storyblok/lint-config";

// Root lint run. Every project under `packages/` and `tools/` lints itself, with
// its own preset and its own ignores, so this run covers only what no project
// owns: repo config, the release scripts, agent scripts.
//
// The root `lint` script passes `--disable-nested-config`, without which Oxlint
// loads every nested `oxlint.config.ts` before applying these ignores.
export default defineConfig({
  extends: [base],
  ignorePatterns: [
    "**/dist/",
    "**/node_modules/",
    "packages/",
    // Not the tool projects' files, but the loose scripts in `tools/` itself.
    "tools/*/",
    // Symlink to `.agents/skills/`, which is linted under its real path.
    ".claude/skills/",
  ],
});

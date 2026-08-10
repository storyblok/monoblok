import { defineConfig } from "vite-plus";

// Repo-wide formatting config. `vp fmt` only reads the Vite+ config in its own
// working directory, so formatting is owned by the root: `pnpm format` formats
// every package from here. Packages therefore have no `format` script of their
// own — a per-package `vp fmt` would silently fall back to Oxfmt's defaults.
export default defineConfig({
  fmt: {
    overrides: [
      {
        // Wrap Markdown prose at `printWidth` instead of preserving whatever line
        // breaks the author happened to type. This matches how Claude Code emits
        // Markdown, so agent-written docs land already formatted — and wrapped
        // lines keep diffs tight, which makes them cheaper for agents to read.
        //
        // Scoped to Markdown on purpose: `proseWrap` also applies to YAML, where
        // it folds long plain scalars across lines and mangles things like GitHub
        // Actions `run:` commands.
        files: ["**/*.md", "**/*.mdx"],
        options: { proseWrap: "always" },
      },
    ],
  },
});

import { defineConfig } from "oxlint";

/**
 * Storyblok base Oxlint preset.
 *
 * Rules with no Oxlint equivalent at the time of writing are listed below as
 * comments, so the intent stays visible if/when Oxlint adds them.
 */
export default defineConfig({
  plugins: ["typescript", "unicorn", "import", "node", "promise"],
  categories: {
    correctness: "error",
    suspicious: "warn",
    perf: "warn",
  },
  rules: {
    // Force braces on every if/for/while body (no single-statement form).
    "eslint/curly": ["error", "all"],

    // Filenames are not enforced — packages use whatever convention fits.
    "unicorn/filename-case": "off",

    // --- Unsupported in Oxlint ---
    //
    // Stylistic — handled by `vp fmt` (Oxfmt), not lint:
    //   'style/function-call-spacing': ['error', 'never']
    //
    // antfu's `top-level-function` rule (no Oxlint port):
    //   'antfu/top-level-function': 'off'
    //
    // perfectionist's import sorter (no Oxlint port; eslint/sort-imports is
    // off-by-default in Oxlint):
    //   'perfectionist/sort-imports': 'off'
    //
    // eslint-plugin-n's `prefer-global/process` (no Oxlint port):
    //   'node/prefer-global/process': 'off'
  },
});

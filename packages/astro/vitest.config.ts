/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    // Only the unit tests. `test/visual-editor` holds Playwright specs for
    // manual QA against a real space: Vitest's default `**/*.spec.ts` pattern
    // otherwise collects them, and importing one throws on the missing
    // STORYBLOK_SPACE_ID that only a QA run exports.
    include: ["tests/**/*.test.ts"],
    typecheck: {
      enabled: true,
      // `tsconfig.json` only `include`s `src`, so `tests/**/*.test-d.ts`
      // fall outside its program and Vitest silently skips typechecking
      // them — no error, no warning, the suite just reports no type
      // errors regardless of what the file says. Point at a dedicated
      // tsconfig that also covers `tests` instead.
      tsconfig: "./tsconfig.vitest.json",
    },
  },
});

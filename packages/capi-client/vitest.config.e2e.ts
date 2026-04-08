/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Vitest config for end-to-end tests that hit the real Storyblok APIs.
 *
 * These tests are NOT run in CI. Trigger them manually:
 *   pnpm --filter @storyblok/api-client test:e2e
 *
 * Prerequisites:
 *   - A .env.qa-engineer-manual file at the repo root with STORYBLOK_TOKEN and STORYBLOK_SPACE_ID.
 *   - Both @storyblok/api-client and @storyblok/management-api-client must be built.
 */
export default defineConfig({
  test: {
    include: ['./test/specs/**/*.spec.e2e.ts'],
    setupFiles: ['./test/setup.e2e.ts'],
    globals: true,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});

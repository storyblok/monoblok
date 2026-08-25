import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["./test/e2e/**/*.test.ts"],
    // Booting the playground's dev server takes a while.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

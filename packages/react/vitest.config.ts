/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
    // Allow-list, not deny-list: `test/visual-editor/**` holds Playwright
    // specs for manual QA against a real space (matches the same pattern in
    // packages/astro and packages/nuxt). Vitest's default `**/*.spec.ts`
    // pattern would otherwise collect them and fail on the missing
    // STORYBLOK_SPACE_ID that only a QA run exports.
    include: ["src/**/*.test.{ts,tsx}"],
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
      allFiles: true,
      include: ["src/**/*.test.{ts,tsx}"],
    },
  },
});

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
    exclude: ["e2e/**", "**/node_modules/**"],
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
      allFiles: true,
      include: ["src/**/*.test.{ts,tsx}"],
    },
  },
});

/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // ... Specify options here.
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    env: {
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
  },
});

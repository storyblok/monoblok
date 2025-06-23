/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    // ... Specify options here.
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    env: {
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
  },
});

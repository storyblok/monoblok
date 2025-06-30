/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/*.config.js',
        '**/*.config.mjs',
        '**/test-setup/**',
      ],
    },
    env: {
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
    // Enable fetch for MSW in Node.js environment
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['./tests/**/*.e2e.ts'],
    testTimeout: 30_000,
    teardownTimeout: 45_000,
  },
  resolve: {
    alias: {
      'storyblok-js-client': path.resolve(__dirname, 'dist'),
    },
  },
});

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    teardownTimeout: 45_000,
    projects: [
      {
        test: {
          include: ['**/*.spec.ts', '!**/*.integration.spec.ts'],
          name: 'unit',
          environment: 'node',
        },
      },
      {
        test: {
          include: ['**/*.integration.spec.ts'],
          name: 'integration',
          environment: 'node',
          testTimeout: 30_000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      'storyblok-js-client': path.resolve(__dirname, 'dist'),
    },
  },
});

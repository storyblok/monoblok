/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    env: {
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
    projects: [
      {
        test: {
          globals: true,
          setupFiles: ['./test/setup.ts'],
          include: ['**/*.{spec,test}.ts', '!**/*.integration.{spec,test}.ts'],
          name: 'unit',
          environment: 'node',
        },
      },
      {
        test: {
          include: ['**/*.integration.spec.ts'],
          name: 'integration',
          environment: 'node',
        },
      },
    ],
  },
});

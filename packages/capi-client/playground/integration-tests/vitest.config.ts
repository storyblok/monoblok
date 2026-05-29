/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [],
    typecheck: {
      enabled: true,
      include: ['./test/types/**/*.test-d.ts'],
    },
  },
});

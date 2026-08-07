/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', './playground/**'],
    typecheck: {
      enabled: true,
      exclude: ['**/node_modules/**', '**/dist/**', './playground/**'],
    },
  },
});

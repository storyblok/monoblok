import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run the type-level regression tests (`*.test-d.ts`) alongside the
    // runtime unit tests so `expectTypeOf` assertions (e.g. DX-472's write
    // method return types) are actually enforced by `vitest run`, not just
    // by the standalone `test:types` tsc pass.
    typecheck: {
      enabled: true,
      include: ['./src/**/*.test-d.ts'],
    },
  },
});

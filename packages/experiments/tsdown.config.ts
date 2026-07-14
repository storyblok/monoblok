import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    adapters: './src/adapters.ts',
  },
  format: ['esm', 'cjs'],
  exports: true,
  sourcemap: true,
  dts: true,
  attw: true,
  publint: true,
});

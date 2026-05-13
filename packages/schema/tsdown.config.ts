import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  attw: true,
  exports: true,
  publint: true,
  entry: {
    index: './src/index.ts',
  },
  outDir: './dist',
  format: ['esm', 'cjs'],
  unbundle: true,
});

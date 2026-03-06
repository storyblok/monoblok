import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  attw: true,
  exports: true,
  publint: true,
  external: ['zod'],
  entry: {
    'index': './src/index.ts',
    'mapi/index': './src/mapi/index.ts',
    'zod/index': './src/zod/index.ts',
  },
  outDir: './dist',
  format: ['esm', 'cjs'],
  unbundle: true,
});

import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: false,
  clean: true,
  platform: 'node',
  external: ['typescript', '@hey-api/openapi-ts', 'pathe'],
});

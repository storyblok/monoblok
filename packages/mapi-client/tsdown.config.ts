import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
  ],
  outDir: './dist',
  format: ['esm', 'cjs'],
  globalName: 'StoryblokManagementApiClient',
  sourcemap: true,
  clean: true,
  dts: true,
  attw: true,
  exports: true,
  publint: true,
  unbundle: true,
});

import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
  ],
  outDir: './dist',
  platform: 'neutral',
  format: ['esm', 'commonjs'],
  globalName: 'StoryblokApiClient',
  sourcemap: true,
  clean: true,
  dts: true,
  attw: true,
  exports: true,
  unbundle: true,
});

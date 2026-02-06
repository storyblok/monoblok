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
  unbundle: true,
});

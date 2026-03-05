import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
  ],
  outDir: './dist',
  platform: 'neutral',
  format: ['esm', 'commonjs'],
  globalName: 'StoryblokManagementApiClient',
  sourcemap: true,
  attw: {
    profile: 'node16',
  },
  clean: true,
  dts: true,
  publint: true,
  unbundle: true,
});

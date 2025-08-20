import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/generated/**/types.gen.ts',
  ],
  outDir: './dist',
  platform: "neutral",
  format: ['esm', "commonjs"],
  globalName: 'StoryblokManagementApiClient',
  sourcemap: true,
  clean: true,
  dts: true,
  unbundle: true,
  external: [
    // Externalize generated client duplicates to reduce bundle size
    "./src/generated/*/client/*",
    "./src/generated/*/core/*"
  ]
});

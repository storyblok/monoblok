import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: './src/index.ts',
  outDir: './dist',
  platform: "neutral",
  format: ['esm', "commonjs"],
  globalName: 'StoryblokMapiClient',
  sourcemap: true,
  clean: true,
  dts: true,
  bundle: false,
  external: [
    // Externalize generated client duplicates to reduce bundle size
    './generated/*/client/**',
  ],
  unbundle: true,
  treeshake: true,
  minify: {
    mangle: true,
    compress: true
  }
});

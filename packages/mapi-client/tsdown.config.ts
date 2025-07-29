import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: './dist',
  format: ['esm', 'umd'],
  globalName: 'StoryblokMapiClient',
  sourcemap: true,
  clean: true,
  dts: true,
});

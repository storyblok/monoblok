import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: './dist',
  format: ['esm', 'umd'],
  globalName: 'storyblokRichtext',
  attw: true,
  sourcemap: true,
  clean: true,
  dts: true,
  external: ['mdast'],
});

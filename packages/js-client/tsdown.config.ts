import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['./src/index.ts'],
    outDir: './dist',
    format: ['cjs', 'esm', 'umd'],
    globalName: 'StoryblokJSClient',
    sourcemap: true,
    clean: true,
    dts: true,
    attw: true,
    exports: true,
  },
]);

import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['./src/index.ts'],
    outDir: './dist',
    format: ['esm'],
    globalName: 'StoryblokReact',
    // sourcemap: true,
    // clean: true,
    // dts: true,
    // attw: true,
    // exports: true,
    external: [
      // 'react',
      // 'react-dom',
      // 'react/jsx-runtime',
      // 'react/jsx-dev-runtime',
      // 'next',
      // 'next/cache',
      // 'next/server',
      // '@storyblok/js',
      // /^next\//,
    ],
  },
]);

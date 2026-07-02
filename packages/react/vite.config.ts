import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import preserveDirectives from 'rollup-plugin-preserve-directives';
import dts from 'vite-plugin-dts';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
    preserveDirectives(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: {
        'index': resolve(__dirname, 'src/index.ts'),
        'ssr': resolve(__dirname, 'src/ssr/index.ts'),
        'rsc': resolve(__dirname, 'src/rsc/index.ts'),
        // v2 experimental entries
        'next': resolve(__dirname, 'src/v2/index.ts'),
        'next/rsc': resolve(__dirname, 'src/v2/rsc/index.ts'),
        'next/client': resolve(__dirname, 'src/v2/client/index.ts'),
      },
      name: 'storyblokReact',
      fileName: (format, entry) => {
        const name = entry;
        return format === 'es' ? `${name}.mjs` : `${name}.js`;
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'next',
        'next/cache',
        'next/server',
        '@storyblok/js',
        '@storyblok/richtext',
        /^next\//,
      ],
      output: {
        globals: { react: 'React' },
      },
    },
  },
  test: {
    globals: true,
    include: ['./src/__tests__/**/*'],
    exclude: ['./src/__tests__/cypress', './src/__tests__/testing-components'],
  },
});

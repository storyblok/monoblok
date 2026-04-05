import { defineConfig, type Plugin } from 'vitest/config';
import { resolve } from 'node:path';
import { lightGreen } from 'kolorist';
import banner from 'vite-plugin-banner';
import dts from 'vite-plugin-dts';

import pkg from './package.json';

// eslint-disable-next-line no-console
console.log(`${lightGreen('StoryblokJS')} v${pkg.version}`);

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
    banner({
      content: `/**\n * name: ${pkg.name}\n * (c) ${new Date().getFullYear()}\n * description: ${pkg.description}\n * author: ${pkg.author}\n */`,
    }),
  ] as Plugin[],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        api: resolve(__dirname, 'src/api.ts'),
        bridge: resolve(__dirname, 'src/bridge.ts'),
        editable: resolve(__dirname, 'src/editable.ts'),
      },
      name: 'storyblok',
      fileName: (format, entry) => {
        return format === 'es' ? `${entry}.mjs` : `${entry}.js`;
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['@storyblok/richtext', 'storyblok-js-client'],
      output: {
        preserveModules: true,
        globals: {
          '@storyblok/richtext': 'StoryblokRichtext',
          'storyblok-js-client': 'StoryblokClient',
        },
      },
    },
  },
  test: {
    globals: true,
    include: ['./src/**/*.test.ts'],
    exclude: ['./cypress'],
    coverage: {
      include: ['src'],
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './tests/unit/coverage',
    },
    environment: 'jsdom',
  },
});

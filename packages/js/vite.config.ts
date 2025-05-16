import { defineConfig, type Plugin } from 'vitest/config';
import path from 'node:path';
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
    }),
    banner({
      content: `/**\n * name: ${pkg.name}\n * (c) ${new Date().getFullYear()}\n * description: ${pkg.description}\n * author: ${pkg.author}\n */`,
    }),
  ] as Plugin[],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src', 'index.ts'),
      name: 'storyblok',
      fileName: (format) => {
        const name = 'storyblok-js';
        return format === 'es' ? `${name}.mjs` : `${name}.js`;
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

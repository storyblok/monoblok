import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'node:fs';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'index': path.resolve(__dirname, 'src/index.ts'),
        'richtext': path.resolve(__dirname, 'src/richtext.ts'),
        'types': path.resolve(__dirname, 'src/types.ts'),
        'utils/toCamelCase': path.resolve(__dirname, 'src/utils/toCamelCase.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'astro',
        '@astrojs/check',
        'typescript',
        '@storyblok/js',
        '@storyblok/richtext',
        'storyblok-js-client',
        'morphdom',
        'camelcase',
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  plugins: [
    dts({
      afterBuild: () => {
        const indexDtsPath = path.resolve(__dirname, 'dist/index.d.ts');

        if (fs.existsSync(indexDtsPath)) {
          const currentContent = fs.readFileSync(indexDtsPath, 'utf-8');
          const referenceLine = `/// <reference path="./public.d.ts" />`;

          if (!currentContent.includes(referenceLine)) {
            const newContent = `${referenceLine}\n${currentContent}`;
            fs.writeFileSync(indexDtsPath, newContent);
          }
        }
      },
    }),
    viteStaticCopy({
      targets: [
        { src: 'src/live-preview/middleware.ts', dest: 'live-preview' },
        { src: 'src/dev-toolbar/toolbarApp.ts', dest: 'dev-toolbar' },
        {
          src: ['src/lib/richTextToHTML.ts', 'src/lib/client.ts'],
          dest: 'lib',
        },
        { src: 'src/public.d.ts', dest: '.' },
        {
          src: [
            'src/components/StoryblokComponent.astro',
            'src/components/FallbackComponent.astro',
            'src/components/StoryblokServerData.astro',
          ],
          dest: 'components',
        },
      ],
    }),
  ],
});

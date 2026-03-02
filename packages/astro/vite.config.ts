import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'node:fs';

export default defineConfig(() => {
  return {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/index.ts'),
        name: 'storyblokAstro',
        fileName: format => `storyblok-astro.${format}.js`,
      },
      rollupOptions: {
        external: ['astro', '@astrijs/check', 'typescript'],
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
            src: ['src/lib/client.ts'],
            dest: 'lib',
          },
          { src: 'src/public.d.ts', dest: '.' },
          {
            src: [
              'src/components/StoryblokComponent.astro',
              'src/components/FallbackComponent.astro',
            ],
            dest: 'components',
          },
        ],
      }),
    ],
  };
});

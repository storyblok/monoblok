import { defineConfig } from 'astro/config';
import { storyblok } from '@storyblok/astro';
import mkcert from 'vite-plugin-mkcert';
import vercel from '@astrojs/vercel';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  integrations: [
    svelte(),
    vue(),
    react(),
    storyblok({
      accessToken: 'OsvNv534kS2nivAAj1EPVgtt',
      apiOptions: {
        cache: {
          clear: 'auto',
          type: 'memory',
        },
      },
      useCustomApi: false,
      bridge: {
        resolveRelations: ['featured-articles.posts'],
      },
      enableFallbackComponent: true,
      componentsDir: '../shared',
      customFallbackComponent: 'components/TestFallback.astro',
      livePreview: true,
      components: {
        // teaser: 'components/TestTeaser.astro',
      },
    }),
  ],
  vite: {
    plugins: [mkcert()],
    resolve: {
      alias: {
        '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
  },
  output: 'server',
  adapter: vercel(),
  /**
   * Note: to build an SSR test environment using the WIP version, host generated package on Git, e.g. git+https://github.com/manuelschroederdev/storyblok-astro-dist
   */
});

import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';
import react from '@astrojs/react';
import { storyblok } from '@storyblok/astro';
import mkcert from 'vite-plugin-mkcert';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  integrations: [
    svelte(),
    vue(),
    react(),
    storyblok({
      accessToken: 'OsvNv534kS2nivAAj1EPVgtt',
      apiOptions: {
        cache: { clear: 'auto', type: 'memory' },
      },
      enableFallbackComponent: true,
      componentsDir: '../shared',
      components: {
        'page': 'storyblok/Page',
        'feature': 'storyblok/Feature',
        'grid': 'storyblok/Grid',
        'teaser': 'storyblok/Teaser',
        'vue_counter': 'storyblok/VueCounter',
        'svelte_counter': 'storyblok/SvelteCounter',
        'react_counter': 'storyblok/ReactCounter',
        'new-component': 'storyblok/NewComponent',
        'featured-articles': 'storyblok/FeaturedArticles',
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
});

// @ts-check
import { defineConfig } from 'astro/config';
import { storyblok } from '@storyblok/astro';
import { loadEnv } from 'vite';

import tailwindcss from '@tailwindcss/vite';

const env = loadEnv('', process.cwd(), 'STORYBLOK');

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
  },
  integrations: [
    storyblok({
      accessToken: env.STORYBLOK_TOKEN,
      components: {
        // Add your components here
      },
    }),
  ],
});

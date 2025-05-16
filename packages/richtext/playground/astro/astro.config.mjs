// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import { storyblok } from '@storyblok/astro';

// Get the directory path using import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  integrations: [
    storyblok({
      accessToken: 'xUMqa0Ka06Cfnrjb4M1e5Qtt',
    }),
  ],
  // Add path aliases configuration
  vite: {
    resolve: {
      alias: {
        // Define your aliases here
        '@storyblok/richtext': resolve(__dirname, '../../src/index.ts'),
      },
    },
  },
});

/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { storyblok } from './src/index';

export default getViteConfig({
}, {
  integrations: [storyblok({
    accessToken: '',
  })],
});

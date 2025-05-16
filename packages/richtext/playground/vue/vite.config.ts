import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'pathe';

import { qrcode } from 'vite-plugin-qrcode';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    basicSsl(),
    vue(),
    qrcode(), // only applies in dev mode
  ],
  resolve: {
    alias: {
      '@storyblok/richtext': resolve(__dirname, '../../src/index.ts'),
      '@storyblok/vue-richtext': resolve(__dirname, '../../packages/vue/src/index.ts'),
    },
  },
});

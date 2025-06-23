import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'pathe';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    basicSsl(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@storyblok/vue': resolve(__dirname, '../../src/index.ts'),
    },
  },
});

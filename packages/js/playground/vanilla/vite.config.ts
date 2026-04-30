import { defineConfig } from "vite";
// import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve } from "pathe";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // basicSsl()
  ],
  resolve: {
    alias: {
      "@storyblok/js": resolve(import.meta.dirname, "../../src/index.ts"),
    },
  },
});

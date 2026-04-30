import { defineConfig } from "vite";

import { resolve } from "pathe";

import { qrcode } from "vite-plugin-qrcode";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    basicSsl(),
    qrcode(), // only applies in dev mode
  ],
  server: {
    https: true,
  },
  resolve: {
    alias: {
      "@storyblok/richtext/markdown-parser": resolve(
        import.meta.dirname,
        "../../src/markdown-parser.ts",
      ),
      "@storyblok/richtext/html-parser": resolve(import.meta.dirname, "../../src/html-parser.ts"),
      "@storyblok/richtext": resolve(import.meta.dirname, "../../src/index.ts"),
    },
  },
});

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import basicSsl from "@vitejs/plugin-basic-ssl";

// The Visual Editor only loads preview URLs over HTTPS.
export default defineConfig({
  plugins: [basicSsl(), vue()],
  resolve: {
    alias: {
      // Use the plugin's source, so changes show up without a rebuild.
      "@storyblok/accessibility-checker": new URL("../src/index.ts", import.meta.url).pathname,
    },
  },
});

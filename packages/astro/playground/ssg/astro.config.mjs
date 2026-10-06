import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [mkcert()],
  },
});

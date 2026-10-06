import { defineConfig } from "astro/config";
import mkcert from "vite-plugin-mkcert";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [mkcert()],
  },
  output: "server",
  adapter: vercel(),
});

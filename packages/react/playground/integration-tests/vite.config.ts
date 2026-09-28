import type { PluginOption } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Falls back to the shared public demo space (same one playground/react uses)
// so the app still boots without STORYBLOK_ACCESS_TOKEN; `qa:dev` always
// overrides it with the QA space's token so `_uid`-addressed assertions can
// find seeded content.
const DEMO_ACCESS_TOKEN = "OurklwV5XsDJTIE1NJaD2wtt";

export default defineConfig({
  plugins: [react(), basicSsl()] as PluginOption[],
  define: {
    "import.meta.env.VITE_STORYBLOK_ACCESS_TOKEN": JSON.stringify(
      process.env.STORYBLOK_ACCESS_TOKEN ?? DEMO_ACCESS_TOKEN,
    ),
  },
  server: {
    // Fixed on purpose: the space's preview domain must match exactly, and
    // Vite silently serving the next free port would leave it pointed at
    // nothing, which looks like a dead bridge, not a port conflict.
    port: 5273,
    strictPort: true,
  },
});

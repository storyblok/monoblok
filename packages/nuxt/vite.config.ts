import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  // The composable checks `import.meta.client`/`import.meta.server`, constants Nuxt's
  // build normally replaces. Unit tests run outside a Nuxt build, so define them here.
  define: {
    "import.meta.client": "true",
    "import.meta.server": "false",
  },
});

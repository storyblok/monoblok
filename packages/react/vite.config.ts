import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import preserveDirectives from "rollup-plugin-preserve-directives";
import dts from "vite-plugin-dts";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
    preserveDirectives(),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        ssr: resolve(import.meta.dirname, "src/ssr/index.ts"),
        rsc: resolve(import.meta.dirname, "src/rsc/index.ts"),
      },
      name: "storyblokReact",
      fileName: (format, entry) => {
        const name = entry;
        return format === "es" ? `${name}.mjs` : `${name}.js`;
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "next",
        "next/cache",
        "next/server",
        "@storyblok/js",
        /^next\//,
      ],
      output: {
        preserveModules: true,
        globals: { react: "React" },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["./src/__tests__/**/*"],
    exclude: ["./src/__tests__/cypress", "./src/__tests__/testing-components"],
  },
});

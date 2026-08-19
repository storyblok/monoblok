import { defineConfig } from "vite-plus";

import pkg from "./package.json" with { type: "json" };

const banner = `/**\n * name: ${pkg.name}\n * (c) ${new Date().getFullYear()}\n * description: ${pkg.description}\n */`;

export default defineConfig({
  pack: [
    {
      attw: { level: "error", profile: "node16" },
      banner,
      dts: true,
      entry: { index: "./src/index.ts" },
      format: ["esm", "cjs", "umd"],
      globalName: "storyblok",
      outDir: "./dist",
      outputOptions: {
        globals: {
          "@storyblok/preview-bridge": "StoryblokBridge",
          "@storyblok/richtext": "StoryblokRichtext",
          "storyblok-js-client": "StoryblokClient",
        },
      },
      publint: true,
    },
  ],

  test: {
    globals: true,
    include: ["./src/**/*.test.ts"],
    exclude: ["./cypress"],
    coverage: {
      include: ["src"],
      reporter: ["text", "json", "html"],
      reportsDirectory: "./tests/unit/coverage",
    },
    environment: "jsdom",
  },
});

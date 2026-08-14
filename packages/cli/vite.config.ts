import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: [
    {
      entry: {
        index: "./src/index.ts",
        "config/index": "./src/entrypoints/config.ts",
      },
      format: ["esm"],
      outDir: "./dist",
      sourcemap: true,
      clean: true,
      dts: true,
    },
    // `types generate` copies these declarations into the user's `types/storyblok.d.ts`,
    // so they ship as product output and must not reference anything outside themselves.
    // A dedicated single-entry build guarantees that: there is no second entry to split
    // shared declarations into a chunk, and no CLI runtime to hoist imports from. Keep
    // the entry name in sync with STORYBLOK_TYPES_FILENAME in
    // src/commands/types/generate/actions.ts.
    {
      entry: { "storyblok-types": "./src/types/storyblok.ts" },
      format: ["esm"],
      outDir: "./dist",
      clean: false,
      dts: { emitDtsOnly: true },
    },
  ],
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
    env: {
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  },
});

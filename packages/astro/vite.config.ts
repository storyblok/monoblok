import { defineConfig } from "vite-plus";
import fs from "node:fs";
import path from "node:path";

const REFERENCE_LINE = `/// <reference path="./public.d.ts" />`;

/**
 * `src/public.d.ts` declares the ambient `astro:*` module shims consumers need.
 * A `///` reference is the only way to pull it in from the entry declaration,
 * and no bundler emits one, so it is prepended after the build.
 */
function prependPublicReference() {
  const entryDts = path.resolve(import.meta.dirname, "dist/index.d.mts");

  if (!fs.existsSync(entryDts)) {
    return;
  }

  const contents = fs.readFileSync(entryDts, "utf-8");

  if (!contents.includes(REFERENCE_LINE)) {
    fs.writeFileSync(entryDts, `${REFERENCE_LINE}\n${contents}`);
  }
}

export default defineConfig({
  pack: [
    {
      // `.astro` entry points are compiled by Astro, not resolved by
      // TypeScript, so they are outside what attw can model. `esm-only` waives
      // the CJS modes, which this package does not ship.
      attw: {
        entrypoints: [".", "./middleware.ts", "./toolbarApp.ts", "./client"],
        level: "error",
        profile: "esm-only",
      },
      // The `.astro` components and the three entry points Astro compiles from
      // source are published as-is, so they are copied rather than bundled.
      copy: [
        { from: "src/components", to: "dist", flatten: false },
        { from: "src/dev-toolbar/toolbarApp.ts", to: "dist/dev-toolbar" },
        { from: "src/lib/client.ts", to: "dist/lib" },
        { from: "src/live-preview/middleware.ts", to: "dist/live-preview" },
        { from: "src/public.d.ts", to: "dist" },
      ],
      dts: true,
      entry: { index: "./src/index.ts" },
      format: ["esm"],
      hooks: { "build:done": prependPublicReference },
      outDir: "./dist",
      publint: true,
    },
    {
      // Declarations only: the runtime files these describe are copied above as
      // TypeScript sources, because Astro compiles them itself.
      dts: { emitDtsOnly: true },
      entry: {
        "dev-toolbar/toolbarApp": "./src/dev-toolbar/toolbarApp.ts",
        "live-preview/middleware": "./src/live-preview/middleware.ts",
      },
      format: ["esm"],
      outDir: "./dist",
    },
  ],
});

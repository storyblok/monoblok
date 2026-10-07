import { defineConfig } from "vite-plus";

/**
 * `.astro` files are not JavaScript, so the bundler cannot parse them. They
 * are shipped verbatim and compiled by the consumer's Vite, which means they
 * must be treated as external imports and left for `copy`.
 */
const externalAstroComponents = {
  name: "external-astro-components",
  resolveId(source: string) {
    if (source.endsWith(".astro")) {
      return { id: source, external: true };
    }
  },
};

export default defineConfig({
  pack: {
    // `unbundle` mirrors `src/` into `dist/` one module at a time. The
    // `.astro` components are copied as-is and import `../registry`,
    // `../types`, etc. relatively, so those modules have to exist next to
    // them as their own files. It also guarantees the block registry stays a
    // single module instance instead of being inlined into `index.js`.
    //
    // The bundler never parses `.astro` files (see `externalAstroComponents`
    // below), so a module reachable only from a component's own `<script>` -
    // not re-exported from `src/index.ts` - would otherwise be silently
    // dropped from `dist/`. `live-preview/preview-handler` is only imported
    // from `StoryblokPreview.astro`'s script, so it's listed as its own
    // entry; `get-new-html-body` comes along for free as its dependency.
    entry: ["src/index.ts", "src/live-preview/preview-handler.ts"],
    unbundle: true,
    format: ["esm"],
    copy: [{ from: "src/**/*.astro", to: "dist", flatten: false }],
    plugins: [externalAstroComponents],
    dts: true,
    outDir: "./dist",
    // `.astro` entry points are compiled by Astro, not resolved by
    // TypeScript, so they are outside what attw can model. `esm-only` waives
    // the CJS modes, which this package does not ship.
    attw: {
      entrypoints: ["."],
      level: "error",
      profile: "esm-only",
      ignoreRules: ["internal-resolution-error"],
    },
    publint: true,
  },
});

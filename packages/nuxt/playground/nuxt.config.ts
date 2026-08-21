export default defineNuxtConfig({
  modules: ["@storyblok/nuxt"],

  imports: {
    transform: {
      // Nuxt only skips auto-import injection for ids inside node_modules.
      // pnpm resolves peerless (or peer-deduplicated) workspace dependencies
      // as plain symlinks into `packages/*`, so their prebuilt bundles reach
      // unimport as project source. Its declaration scan misses identifiers
      // declared as later declarators in a minified `var a = ..., h = ...`,
      // and the injected `import { h } from "vue"` then breaks the build with
      // `Identifier "h" has already been declared`. Keep every workspace
      // `dist` out of the transform; it is prebuilt, never project source.
      exclude: [/[\\/]packages[\\/][^\\/]+[\\/]dist[\\/]/],
    },
  },
  storyblok: {
    accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
    apiOptions: {
      region: "",
    },
    devtools: true,
  },

  app: {
    head: {
      script: [{ src: "https://cdn.tailwindcss.com" }],
    },
  },

  compatibilityDate: "2025-01-13",
});

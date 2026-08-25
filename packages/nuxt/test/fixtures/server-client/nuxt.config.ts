import { defineNuxtConfig } from "nuxt/config";
import StoryblokModule from "../../../src/module";

export default defineNuxtConfig({
  modules: [StoryblokModule],

  imports: {
    transform: {
      // See packages/nuxt/playground/nuxt.config.ts for why workspace `dist`
      // output must stay out of unimport's scan.
      exclude: [/[\\/]packages[\\/][^\\/]+[\\/]dist[\\/]/],
    },
  },

  storyblok: {
    accessToken: "fixture-secret-token",
    enableServerClient: true,
  },

  compatibilityDate: "2025-01-13",
} as any);

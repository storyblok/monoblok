import { defineQaConfig } from "@storyblok/visual-editor-qa";

/**
 * The port is not overridable: `qa:dev` pins 3200, so any other value would only
 * make Playwright's `webServer.url` wait on a port nothing serves.
 *
 * The editor previews a story at its `full_slug`, so it loads `/vue`, which the
 * catch-all route serves, not the playground's own `/articles/:slug`.
 */
export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/nuxt",
  previewBaseUrl: "https://localhost:3200",
  previewPath: "/vue",
  seededMarker: "QA teaser",
  scenario: "has-playground-content",
  scenarioDir: "packages/nuxt/test/scenarios",
  accessTokenEnvVar: "NUXT_PUBLIC_STORYBLOK_ACCESS_TOKEN",
  expectedSlugs: [
    "vue",
    "vue/test",
    "vue/test-richtext",
    "vue/articles/first-article",
    "vue/articles/second-article",
  ],
  relation: {
    storySlug: "vue",
    component: "popular-articles",
    field: "articles",
    count: 2,
  },
});

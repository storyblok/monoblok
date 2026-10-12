import { defineQaConfig } from "@storyblok/visual-editor-qa";

/**
 * Live editing needs SSR, so this drives `playground/integration-tests`
 * only, on its fixed port.
 */
export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/playground-astro-integration-tests",
  previewBaseUrl: "https://localhost:4322",
  previewPath: "/home",
  seededMarker: "QA teaser headline",
  scenario: "has-playground-content",
  scenarioDir: "packages/astro/test/scenarios",
  accessTokenEnvVar: "STORYBLOK_ACCESS_TOKEN",
  expectedSlugs: [
    "home",
    "test",
    "about-us",
    "articles/first-article",
    "articles/second-article",
    "hydration",
  ],
  relation: {
    storySlug: "home",
    component: "featured-articles",
    field: "posts",
    count: 2,
  },
});

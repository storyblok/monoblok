import { defineQaConfig } from "@storyblok/visual-editor-qa";

export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/playground-svelte-integration-tests",
  previewBaseUrl: "https://localhost:5174",
  previewPath: "/home",
  seededMarker: "QA teaser headline",
  scenario: "has-playground-content",
  scenarioDir: "packages/svelte/test/scenarios",
  accessTokenEnvVar: "STORYBLOK_PREVIEW_TOKEN",
  expectedSlugs: ["home", "articles/first-article", "articles/second-article"],
  relation: {
    storySlug: "home",
    component: "featured-articles",
    field: "posts",
    count: 2,
  },
});

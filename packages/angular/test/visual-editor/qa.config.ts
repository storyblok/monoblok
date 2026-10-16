import { defineQaConfig } from "@storyblok/visual-editor-qa";

export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/angular",
  previewBaseUrl: "https://localhost:4200",
  previewPath: "/",
  seededMarker: "QA broker article content",
  scenario: "has-live-preview-qa",
  scenarioDir: "packages/angular/playground/integration-tests/seeds",
  accessTokenEnvVar: "STORYBLOK_PREVIEW_TOKEN",
  expectedSlugs: ["live-preview", "qa-author"],
  relation: {
    storySlug: "live-preview",
    component: "featured-articles",
    field: "articles",
    count: 1,
  },
});

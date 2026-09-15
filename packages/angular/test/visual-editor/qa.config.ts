import { defineQaConfig } from "@storyblok/visual-editor-qa";

export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/angular",
  previewBaseUrl: "https://localhost:4200",
  previewPath: "/angular/live-preview-qa",
  seededMarker: "Author:",
  scenario: "manual-current-space",
  scenarioDir: "packages/angular/test/scenarios",
  accessTokenEnvVar: "STORYBLOK_PREVIEW_TOKEN",
  expectedSlugs: ["angular/live-preview-qa"],
  relation: {
    storySlug: "angular/live-preview-qa",
    component: "featured-articles",
    field: "articles",
    count: 1,
  },
});

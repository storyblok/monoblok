import { defineQaConfig } from "@storyblok/visual-editor-qa";

/**
 * `qa:dev` builds `@storyblok/react` first and pins the dev server to 5273:
 * Vite silently serving the next free port would leave the space previewing
 * a port nothing serves, indistinguishable from a dead bridge.
 */
export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/react",
  previewBaseUrl: "https://localhost:5273",
  previewPath: "/home",
  seededMarker: "QA teaser headline",
  scenario: "has-playground-content",
  scenarioDir: "packages/react/test/scenarios",
  accessTokenEnvVar: "STORYBLOK_ACCESS_TOKEN",
  expectedSlugs: ["home", "articles/first-article", "articles/second-article"],
  relation: {
    storySlug: "home",
    component: "featured-articles",
    field: "posts",
    count: 2,
  },
});

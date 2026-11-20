import { defineQaConfig } from "@storyblok/visual-editor-qa";

/**
 * Drives the RSC playground (`../../playground/integration-tests-rsc`), written
 * the way the Next.js blueprint uses `@storyblok/react` v7. `qa:dev` builds
 * `@storyblok/react` first and pins the port: a dev server silently serving the
 * next free port would leave the space previewing a port nothing serves.
 */
export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/react",
  previewBaseUrl: "https://localhost:5274",
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

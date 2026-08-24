import { defineQaConfig } from "@storyblok/visual-editor-qa";

/**
 * Live editing needs SSR: `livePreview` throws in SSG mode, so the harness drives
 * `playground/ssr` only. The port is not overridable, because `astro dev` silently
 * picks the next free one when it is taken, which leaves the space previewing a
 * port nothing serves and looks exactly like a dead bridge.
 */
export const QA_CONFIG = defineQaConfig({
  packageName: "@storyblok/astro",
  previewBaseUrl: "https://localhost:4321",
  previewPath: "/home",
  seededMarker: "QA teaser headline",
  scenario: "has-playground-content",
  scenarioDir: "packages/astro/test/scenarios",
  accessTokenEnvVar: "STORYBLOK_ACCESS_TOKEN",
  expectedSlugs: ["home", "test", "articles/first-article", "articles/second-article"],
  relation: {
    storySlug: "home",
    component: "featured-articles",
    field: "posts",
    count: 2,
  },
});

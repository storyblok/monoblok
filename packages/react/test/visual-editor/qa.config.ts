import { defineQaConfig } from "@storyblok/visual-editor-qa";

/**
 * `qa:editor` drives the client (CSR) playground by default; `qa:editor:rsc`
 * sets `QA_TARGET=rsc` to drive the RSC one instead. Both playgrounds render
 * the same seeded schema and `_uid`s, so the exact same spec
 * (`specs/live-editing.spec.ts`) exercises either one unchanged.
 */
const TARGETS = {
  client: {
    packageName: "@storyblok/react",
    devScript: "qa:dev",
    previewBaseUrl: "https://localhost:5273",
  },
  rsc: {
    packageName: "@storyblok/react",
    devScript: "qa:dev:rsc",
    previewBaseUrl: "https://localhost:5274",
  },
} as const;

const TARGET: keyof typeof TARGETS = process.env.QA_TARGET === "rsc" ? "rsc" : "client";

/**
 * `qa:dev`/`qa:dev:rsc` build `@storyblok/react` first and pin the dev server
 * port: a dev server silently serving the next free port would leave the
 * space previewing a port nothing serves, indistinguishable from a dead
 * bridge.
 */
export const QA_CONFIG = defineQaConfig({
  ...TARGETS[TARGET],
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

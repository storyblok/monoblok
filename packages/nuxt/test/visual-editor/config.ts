const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Run: set -a && source ./.env.qa-engineer-manual && set +a`);
  }
  return value;
};

export const QA_CONFIG = {
  /** The Storyblok app. The editor and its preview iframe live here. */
  appBaseUrl: process.env.STORYBLOK_APP_URL ?? "https://app.storyblok.com",
  /**
   * The playground, served over trusted https by the `qa:dev` script.
   * Not overridable: `qa:dev` pins port 3200, so any other value would only
   * make Playwright's `webServer.url` wait on a port nothing serves.
   */
  previewBaseUrl: "https://localhost:3200",
  /** The Management API host. Non-EU spaces need a region-specific host. */
  mapiBaseUrl: process.env.STORYBLOK_MAPI_URL ?? "https://mapi.storyblok.com/v1",
  spaceId: requireEnv("STORYBLOK_SPACE_ID"),
  managementToken: requireEnv("STORYBLOK_TOKEN"),
  // One saved session per repo, shared with one-off scripts. Relative to the
  // package root: every `qa:*` script runs with `packages/nuxt` as its cwd,
  // because that is where pnpm --filter puts it. Avoids `import.meta.dirname`,
  // which breaks if Playwright transpiles this to CJS.
  storageStatePath: process.env.STORYBLOK_QA_SESSION ?? "../../.storyblok-qa/session.json",
} as const;

/** Slugs the `has-playground-content` scenario must have seeded. */
export const EXPECTED_SLUGS = [
  "vue",
  "vue/test",
  "vue/test-richtext",
  "vue/articles/first-article",
  "vue/articles/second-article",
] as const;

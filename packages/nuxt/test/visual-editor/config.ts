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
  /** The playground, served over trusted https by the `qa:dev` script. */
  previewBaseUrl: process.env.QA_PREVIEW_URL ?? "https://localhost:3200",
  spaceId: requireEnv("STORYBLOK_SPACE_ID"),
  managementToken: requireEnv("STORYBLOK_TOKEN"),
  // Relative to the package root. Every `qa:*` script runs with `packages/nuxt`
  // as its cwd, because that is where pnpm --filter puts it. Avoids
  // `import.meta.dirname`, which breaks if Playwright transpiles this to CJS.
  storageStatePath: "test/visual-editor/.auth/storyblok.json",
} as const;

/** Slugs the `has-playground-content` scenario must have seeded. */
export const EXPECTED_SLUGS = [
  "vue",
  "vue/test",
  "vue/test-richtext",
  "vue/articles/first-article",
  "vue/articles/second-article",
] as const;

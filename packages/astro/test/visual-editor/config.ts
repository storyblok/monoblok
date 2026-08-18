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
   * The SSR playground, served over https by `qa:dev`. Live editing needs SSR:
   * `livePreview` throws in SSG mode, so the SSG playground is not covered here.
   * Not overridable — `qa:dev` pins the port, and `astro dev` silently picks the
   * next free one when it is taken, which leaves the space previewing a port
   * nothing serves and looks exactly like a dead bridge.
   */
  previewBaseUrl: "https://localhost:4321",
  /** The Management API host. Non-EU spaces need a region-specific host. */
  mapiBaseUrl: process.env.STORYBLOK_MAPI_URL ?? "https://mapi.storyblok.com/v1",
  spaceId: requireEnv("STORYBLOK_SPACE_ID"),
  managementToken: requireEnv("STORYBLOK_TOKEN"),
  // One saved session per repo, shared with one-off scripts. Relative to the
  // package root: every `qa:*` script runs with `packages/astro` as its cwd.
  storageStatePath: process.env.STORYBLOK_QA_SESSION ?? "../../.storyblok-qa/session.json",
} as const;

/** Slugs the `has-playground-content` scenario must have seeded. */
export const EXPECTED_SLUGS = [
  "home",
  "test",
  "articles/first-article",
  "articles/second-article",
] as const;

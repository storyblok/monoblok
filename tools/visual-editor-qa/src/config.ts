const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Run: set -a && source ./.env.qa-engineer-manual && set +a`);
  }
  return value;
};

/** A relation the seed must have remapped, asserted before the specs run. */
export interface QaRelation {
  /** `full_slug` of the story that holds the block. */
  storySlug: string;
  /** Technical name of the block that holds the relation field. */
  component: string;
  /** Technical name of the relation field. */
  field: string;
  /** How many references the seed puts in it. */
  count: number;
}

/** What a package supplies. Everything else is the same for every framework. */
export interface QaHarnessOptions {
  /** The package under test, e.g. `@storyblok/astro`. Only used in error messages. */
  packageName: string;
  /** Where the package's `qa:dev` script serves its playground over https. */
  previewBaseUrl: string;
  /** Path of a seeded story, e.g. `/home`. The preflight and the health check use it. */
  previewPath: string;
  /** Text that story must render. Proves the app serves the seeded space, not the demo one. */
  seededMarker: string;
  /** Scenario the seed script pushes. */
  scenario: string;
  /** Directory that holds it, e.g. `packages/astro/test/scenarios`. */
  scenarioDir: string;
  /** Env var that points the playground at the QA space. */
  accessTokenEnvVar: string;
  /** Slugs the scenario must have seeded. Folder start pages lose their trailing slash. */
  expectedSlugs: readonly string[];
  relation: QaRelation;
}

export type QaConfig = QaHarnessOptions & {
  appBaseUrl: string;
  mapiBaseUrl: string;
  spaceId: string;
  managementToken: string;
  storageStatePath: string;
  /** The seed command, ready to paste. Every failure message that needs it uses this. */
  seedCommand: string;
};

export const defineQaConfig = (options: QaHarnessOptions): QaConfig => ({
  ...options,
  /** The Storyblok app. The editor and its preview iframe live here. */
  appBaseUrl: process.env.STORYBLOK_APP_URL ?? "https://app.storyblok.com",
  /** The Management API host. Non-EU spaces need a region-specific host. */
  mapiBaseUrl: process.env.STORYBLOK_MAPI_URL ?? "https://mapi.storyblok.com/v1",
  spaceId: requireEnv("STORYBLOK_SPACE_ID"),
  managementToken: requireEnv("STORYBLOK_TOKEN"),
  // One saved session per repo, shared with one-off scripts. Relative to the
  // package root: every `qa:*` script runs with the package as its cwd, because
  // that is where `pnpm --filter` puts it. Avoids `import.meta.dirname`, which
  // breaks if Playwright transpiles this to CJS.
  storageStatePath: process.env.STORYBLOK_QA_SESSION ?? "../../.storyblok-qa/session.json",
  seedCommand:
    "bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh " +
    `--scenario ${options.scenario} --scenario-dir ${options.scenarioDir}`,
});

/** How `verify` runs one blueprint: `configs/<repo-name>.ts`, one per folder in `blueprints/`. */
export type SmokeConfig = {
  /** Runs in the installed project before `build`, for setup a user would do by hand. */
  beforeBuild?: (projectDir: string) => void;
  /** Runs once in the installed project. */
  build: string;
  /** Serves the build. Must bind to the host and port of `url`. */
  start: string;
  /** Where `start` serves the app. Self-signed HTTPS is fine. */
  url: string;
  /**
   * Runs in the page and must return true before the texts count. Server-rendered blueprints need
   * it: their texts are in the HTML before any JS runs, so finding them proves nothing about
   * hydration.
   */
  ready?: () => boolean;
  /** Texts the demo story must render, matched exactly. */
  expect: string[];
};

export async function loadConfig(blueprint: string): Promise<SmokeConfig> {
  const module: { default: SmokeConfig } = await import(`../configs/${blueprint}.ts`);
  return module.default;
}

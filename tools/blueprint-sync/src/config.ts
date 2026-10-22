/** How `verify` and `check` run one blueprint: `configs/<repo-name>.ts`, one per folder in `blueprints/`. */
export type SmokeConfig = {
  /** Runs in the installed project before `build`, for setup a user would do by hand. */
  beforeBuild?: (projectDir: string) => void;
  /**
   * Files `beforeBuild` rewrites, relative to the project. `check` runs in the workspace, not in a
   * temp copy, so it puts them back afterwards: a token must not stay in a tracked file.
   */
  writes?: string[];
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
  /**
   * The texts must also be in the HTML the server sends, before any JS runs. Set for blueprints that
   * server-render: the browser check alone passes when a server falls back to client rendering.
   */
  serverRendered?: boolean;
  /** Texts the demo story must render, matched exactly. */
  expect: string[];
};

export async function loadConfig(blueprint: string): Promise<SmokeConfig> {
  const module: { default: SmokeConfig } = await import(`../configs/${blueprint}.ts`);
  return module.default;
}

import { loadConfig as c12LoadConfig, SUPPORTED_EXTENSIONS } from "c12";

import { defineConfig } from "./types";

const CONFIG_ENTRYPOINT_SPECIFIER = "storyblok/config";

export { SUPPORTED_EXTENSIONS };

/**
 * Load configuration using c12
 * This encapsulates the c12 dependency so it's only referenced within lib/config
 */
export async function loadConfig(options: {
  name: string;
  cwd?: string;
  configFile?: string;
  defaults?: Record<string, any>;
}): Promise<{ config: Record<string, any> | null }> {
  return c12LoadConfig({
    name: options.name,
    cwd: options.cwd,
    configFile: options.configFile,
    defaults: options.defaults || {},
    rcFile: false,
    globalRc: false,
    dotenv: false,
    packageJson: false,
    jitiOptions: {
      // Reading the tsconfig throws when it extends something unresolvable, which
      // would block every command in a project that does not even use aliases.
      // jiti's own JITI_TSCONFIG_PATHS default is overridden by this explicit
      // option, so honour it here to leave users a way out.
      tsconfigPaths: process.env.JITI_TSCONFIG_PATHS !== "false",
      // A CLI run through `npx`, `dlx`, or a global install is not resolvable
      // from the user's project, so the documented
      // `import { defineConfig } from "storyblok/config"` has nothing to
      // resolve to. Serve the helper from the running CLI instead of failing.
      virtualModules: {
        [CONFIG_ENTRYPOINT_SPECIFIER]: { defineConfig },
      },
    },
  });
}

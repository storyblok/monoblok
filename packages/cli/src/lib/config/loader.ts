import { dirname, resolve } from 'node:path';
import { loadConfig as c12LoadConfig, SUPPORTED_EXTENSIONS } from 'c12';
import { getTsconfig } from 'get-tsconfig';

export { SUPPORTED_EXTENSIONS };

function resolveTsconfigAliases(cwd: string): Record<string, string> {
  const tsconfig = getTsconfig(cwd);

  if (!tsconfig) {
    return {};
  }

  const configDirectory = dirname(tsconfig.path);
  const compilerOptions = tsconfig.config.compilerOptions;
  const baseUrl = compilerOptions?.baseUrl
    ? resolve(configDirectory, compilerOptions.baseUrl)
    : configDirectory;
  const paths = compilerOptions?.paths ?? {};

  return Object.fromEntries(
    Object.entries(paths).flatMap(([aliasPattern, targets]) => {
      const firstTarget = targets?.[0];

      if (!firstTarget) {
        return [];
      }

      const alias = aliasPattern.replace(/\/\*$/, '');
      const target = firstTarget.replace(/\/\*$/, '');

      return [[alias, resolve(baseUrl, target)]];
    }),
  );
}

/**
 * Load configuration using c12.
 * This encapsulates the c12 dependency so it is only referenced within lib/config.
 */
export async function loadConfig(options: {
  name: string;
  cwd?: string;
  configFile?: string;
  defaults?: Record<string, any>;
}): Promise<{ config: Record<string, any> | null }> {
  const cwd = options.cwd ?? process.cwd();

  return c12LoadConfig({
    name: options.name,
    cwd,
    configFile: options.configFile,
    defaults: options.defaults || {},
    rcFile: false,
    globalRc: false,
    dotenv: false,
    packageJson: false,
    jitiOptions: {
      alias: resolveTsconfigAliases(cwd),
    },
  });
}

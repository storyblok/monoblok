import { loadConfig as c12LoadConfig, SUPPORTED_EXTENSIONS } from 'c12';

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
  return await c12LoadConfig({
    name: options.name,
    cwd: options.cwd,
    configFile: options.configFile,
    defaults: options.defaults || {},
    rcFile: false,
    globalRc: false,
    dotenv: false,
    packageJson: false,
  });
}

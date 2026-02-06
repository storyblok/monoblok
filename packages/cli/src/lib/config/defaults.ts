import type { GlobalConfig, ResolvedCliConfig } from './types';

const BASE_GLOBAL_CONFIG: GlobalConfig = {
  region: undefined,
  space: undefined,
  path: undefined,
  api: {
    maxRetries: 3,
    maxConcurrency: 6,
  },
  log: {
    console: {
      enabled: false,
      level: 'info',
    },
    file: {
      enabled: true,
      level: 'info',
      maxFiles: 10,
    },
  },
  report: {
    enabled: true,
    maxFiles: 10,
  },
  ui: {
    enabled: true,
  },
  verbose: false,
};

/**
 * Shared immutable default global config for read-only operations.
 * Use this when you only need to read default values without mutation.
 *
 * @export
 * @constant
 */
export const DEFAULT_GLOBAL_CONFIG: Readonly<ResolvedCliConfig> = Object.freeze(
  structuredClone(BASE_GLOBAL_CONFIG),
) as Readonly<ResolvedCliConfig>;

/**
 * Create a new mutable resolved config with default values.
 * Use this when you need to mutate the config.
 *
 * @export
 * @return {ResolvedCliConfig}
 */
export function createDefaultResolvedConfig(): ResolvedCliConfig {
  return structuredClone(BASE_GLOBAL_CONFIG) as ResolvedCliConfig;
}

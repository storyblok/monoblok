import type { GlobalConfig, ResolvedCliConfig } from './types';

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  region: 'eu',
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
 * Create a new resolved config with default values
 *
 * @export
 * @return {ResolvedCliConfig}
 */
export function createDefaultResolvedConfig(): ResolvedCliConfig {
  return structuredClone(DEFAULT_GLOBAL_CONFIG) as ResolvedCliConfig;
}

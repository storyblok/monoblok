import type { GlobalConfig, ResolvedCliConfig } from './types';

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  region: 'eu',
  api: {
    maxRetries: 3,
    maxConcurrency: 6,
  },
  log: {
    console: {
      enabled: true,
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
  verbose: false,
};

export function createDefaultResolvedConfig(): ResolvedCliConfig {
  return structuredClone(DEFAULT_GLOBAL_CONFIG) as ResolvedCliConfig;
}

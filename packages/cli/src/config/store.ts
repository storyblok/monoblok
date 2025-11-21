import type { ResolvedCliConfig } from './types';
import { createDefaultResolvedConfig } from './defaults';

// Singleton snapshot that exposes the last resolved config
let activeConfig: ResolvedCliConfig = createDefaultResolvedConfig();

export function getActiveConfig(): ResolvedCliConfig {
  return activeConfig;
}

export function setActiveConfig(config: ResolvedCliConfig): void {
  activeConfig = structuredClone(config);
}

export function resetActiveConfig(): void {
  activeConfig = createDefaultResolvedConfig();
}

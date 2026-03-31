import { createManagementApiClient, type ManagementApiClient, type ManagementApiClientConfig } from '@storyblok/management-api-client';

import { getActiveConfig } from './lib/config';

let instance: ManagementApiClient | null = null;
let storedConfig: ManagementApiClientConfig | null = null;

function configsAreEqual(config1: ManagementApiClientConfig, config2: ManagementApiClientConfig): boolean {
  return JSON.stringify(config1) === JSON.stringify(config2);
}

export function createMapiClient(options: ManagementApiClientConfig) {
  const { api } = getActiveConfig();
  return createManagementApiClient({
    ...options,
    rateLimit: options.rateLimit ?? (api.maxConcurrency > 0 ? { maxConcurrency: api.maxConcurrency } : false),
  });
}

export function getMapiClient(options?: ManagementApiClientConfig) {
  if (!instance && options) {
    instance = createMapiClient(options);
    storedConfig = options;
  }
  else if (!instance) {
    throw new Error('MAPI client not initialized. Call getMapiClient with configuration first.');
  }
  else if (options && storedConfig && !configsAreEqual(options, storedConfig)) {
    // Create new instance if options differ from stored config
    instance = createMapiClient(options);
    storedConfig = options;
  }
  return instance;
}

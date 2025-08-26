import { ManagementApiClient, type ManagementApiClientConfig } from '@storyblok/management-api-client';

let instance: ManagementApiClient | null = null;
let storedConfig: ManagementApiClientConfig | null = null;

function configsAreEqual(config1: ManagementApiClientConfig, config2: ManagementApiClientConfig): boolean {
  return JSON.stringify(config1) === JSON.stringify(config2);
}

export function mapiClient(options?: ManagementApiClientConfig) {
  if (!instance && options) {
    instance = new ManagementApiClient(options);
    storedConfig = options;
  }
  else if (!instance) {
    throw new Error('MAPI client not initialized. Call mapiClient with configuration first.');
  }
  else if (options && storedConfig && !configsAreEqual(options, storedConfig)) {
    // Create new instance if options are different from stored config
    instance = new ManagementApiClient(options);
    storedConfig = options;
  }
  return instance;
}

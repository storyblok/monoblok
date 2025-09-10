import { ManagementApiClient, type ManagementApiClientConfig } from '@storyblok/management-api-client';
import { RateLimit } from 'async-sema';

let instance: ManagementApiClient | null = null;
let storedConfig: ManagementApiClientConfig | null = null;
const lim = RateLimit(6, {
  uniformDistribution: true,
});

function configsAreEqual(config1: ManagementApiClientConfig, config2: ManagementApiClientConfig): boolean {
  return JSON.stringify(config1) === JSON.stringify(config2);
}

export function mapiClient(options?: ManagementApiClientConfig) {
  if (!instance && options) {
    instance = new ManagementApiClient(options);
    instance.interceptors.request.use(async (request) => {
      await lim();
      return request;
    });
    storedConfig = options;
  }
  else if (!instance) {
    throw new Error('MAPI client not initialized. Call mapiClient with configuration first.');
  }
  else if (options && storedConfig && !configsAreEqual(options, storedConfig)) {
    // Create new instance if options are different from stored config
    instance = new ManagementApiClient(options);
    instance.interceptors.request.use(async (request) => {
      await lim();
      return request;
    });
    storedConfig = options;
  }
  return instance;
}

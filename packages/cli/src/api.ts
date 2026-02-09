import { ManagementApiClient, type ManagementApiClientConfig } from '@storyblok/management-api-client';
import { RateLimit } from 'async-sema';
import { getActiveConfig } from './lib/config';

let instance: ManagementApiClient | null = null;
let storedConfig: ManagementApiClientConfig | null = null;

// Keep the limiter aligned with the currently resolved config (which can change per command run).
let currentLimiterCapacity = Math.max(1, getActiveConfig().api.maxConcurrency);
let limiter = RateLimit(currentLimiterCapacity, { uniformDistribution: true });

function resolveLimiter() {
  const desiredCapacity = Math.max(1, getActiveConfig().api.maxConcurrency);
  if (desiredCapacity !== currentLimiterCapacity) {
    limiter = RateLimit(desiredCapacity, { uniformDistribution: true });
    currentLimiterCapacity = desiredCapacity;
  }
  return limiter;
}

function configsAreEqual(config1: ManagementApiClientConfig, config2: ManagementApiClientConfig): boolean {
  return JSON.stringify(config1) === JSON.stringify(config2);
}

function applyRateLimit(client: ManagementApiClient) {
  if (getActiveConfig().api.maxConcurrency > 0) {
    client.interceptors.request.use(async (request) => {
      const limit = resolveLimiter();
      await limit();
      return request;
    });
  }
}

export function creategetMapiClient(options: ManagementApiClientConfig) {
  const client = new ManagementApiClient(options);
  applyRateLimit(client);
  return client;
}

export function getMapiClient(options?: ManagementApiClientConfig) {
  if (!instance && options) {
    instance = creategetMapiClient(options);
    storedConfig = options;
  }
  else if (!instance) {
    throw new Error('MAPI client not initialized. Call getMapiClient with configuration first.');
  }
  else if (options && storedConfig && !configsAreEqual(options, storedConfig)) {
    // Create new instance if options differ from stored config
    instance = creategetMapiClient(options);
    storedConfig = options;
  }
  return instance;
}

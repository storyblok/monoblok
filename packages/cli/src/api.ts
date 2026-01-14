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

export function mapiClient(options?: ManagementApiClientConfig) {
  if (!instance && options) {
    instance = new ManagementApiClient(options);
    if (getActiveConfig().api.maxConcurrency > 0) {
      instance.interceptors.request.use(async (request) => {
        const limit = resolveLimiter();
        await limit();
        return request;
      });
    }
    storedConfig = options;
  }
  else if (!instance) {
    throw new Error('MAPI client not initialized. Call mapiClient with configuration first.');
  }
  else if (options && storedConfig && !configsAreEqual(options, storedConfig)) {
    // Create new instance if options are different from stored config
    instance = new ManagementApiClient(options);
    if (getActiveConfig().api.maxConcurrency > 0) {
      instance.interceptors.request.use(async (request) => {
        const limit = resolveLimiter();
        await limit();
        return request;
      });
    }
    storedConfig = options;
  }
  return instance;
}

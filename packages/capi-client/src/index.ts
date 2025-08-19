// Import generated SDKs with shared client support
import { createClient } from './client';
import type { Client } from './types';
import { getRegionBaseUrl, type Region } from '@storyblok/region-helper';
import { sdkRegistry, SdkRegistryInstance } from './sdk-registry.generated';

export interface CapiClientConfig {
  token: string;
  region?: Region;
  baseUrl?: string; // Override for custom endpoints
  headers?: Record<string, string>;
}

export interface CapiClient extends SdkRegistryInstance {}
export class CapiClient {
  protected client: Client;
  protected config: CapiClientConfig;
  protected sdkCache: Record<string, Promise<any>> = {};

  constructor(config: CapiClientConfig) {
    this.config = config;
    this.client = createClientInstance(config);

    Object.entries(sdkRegistry).forEach(([name, Sdk]) => {
      Object.defineProperty(this, name, {
        get: () => new Sdk({ client: this.client }),
        enumerable: true,
        configurable: true
      });
    });
  }

  /**
   * @returns The client's interceptors
   * @example
   * client.interceptors.request.use((request, options) => {
   *   console.log('Request:', request);
   *   return request;
   * });
   */
  public get interceptors(): Client['interceptors'] {
    return this.client.interceptors;
  }

  /**
   * @param config - The configuration to set
   * @example
   * client.setConfig({ region: 'eu' });
   */
  setConfig(config: Partial<Omit<CapiClientConfig, 'token'>>): void {
    const { region, baseUrl, headers } = config;
    
    let finalBaseUrl = baseUrl;
    if (region && !baseUrl) {
      finalBaseUrl = getRegionBaseUrl(region, "https");
    }
    
    if (finalBaseUrl) {
      this.client.setConfig({ baseUrl: finalBaseUrl });
    }
    
    if (headers) {
      this.client.setConfig({ 
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
    }
  }

  /**
   * @param token - The token to set
   * @example
   * client.setToken({ token: 'your-public-or-preview-token' });
   */
  setToken(token: string): void {
    this.config.token = token;
  }
}

// Pure functions for client creation and setup
function createClientInstance(
  config: CapiClientConfig
): Client {
  const { token, region = "eu", baseUrl } = config;
  
  const finalBaseUrl = baseUrl || getRegionBaseUrl(region, 'https');
  
  return createClient({
    baseUrl: finalBaseUrl,
    token
  });
}

// Export client utilities
export { createClient } from './client';

// Export filter query utilities
export {
  buildFilterQuery,
  i18nField,
  nestedField,
  nestedProperty,
  // Enum for 'is' operations
  IS,
  type FilterQuery
} from './filter-query';

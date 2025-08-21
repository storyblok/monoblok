// Import generated SDKs with shared client support
import { createClient } from './client';
import type { Client } from './client/types';
import { getManagementBaseUrl, type Region } from '@storyblok/region-helper';
import { sdkRegistry, SdkRegistryInstance } from './sdk-registry.generated';

type PersonalAccessToken = {
  accessToken: string;
}

type OAuthToken = {
  oauthToken: string;
}

export interface ManagementApiClientConfig<ThrowOnError extends boolean = false> {
  token: PersonalAccessToken | OAuthToken;
  region?: Region;
  baseUrl?: string; // Override for custom endpoints
  headers?: Record<string, string>;
  throwOnError?: ThrowOnError;
}

export interface ManagementApiClient<ThrowOnError extends boolean = false> extends SdkRegistryInstance {}
export class ManagementApiClient<ThrowOnError extends boolean = false> {
  protected client: Client;
  protected config: ManagementApiClientConfig<ThrowOnError>;
  protected sdkCache: Record<string, Promise<any>> = {};

  constructor(config: ManagementApiClientConfig<ThrowOnError>) {
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
  setConfig(config: Partial<Omit<ManagementApiClientConfig, 'token'>>): void {
    const { region, baseUrl, headers } = config;
    
    let finalBaseUrl = baseUrl;
    if (region && !baseUrl) {
      finalBaseUrl = getManagementBaseUrl(region, "https");
    }
    
    if (finalBaseUrl) {
      this.client.setConfig({ baseUrl: finalBaseUrl });
    }
    
    if (headers) {
      this.client.setConfig({ 
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(this.config.token),
          ...headers
        }
      });
    }
  }

  /**
   * @param token - The token to set
   * @example
   * client.setToken({ accessToken: '123' });
   */
  setToken(token: PersonalAccessToken | OAuthToken): void {
    this.config.token = token;
    this.client.setConfig({
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
        ...this.config.headers
      }
    });
  }
}

// Pure functions for client creation and setup
function createClientInstance<ThrowOnError extends boolean = false>(
  config: ManagementApiClientConfig<ThrowOnError>
): Client {
  const { token, region = "eu", baseUrl, headers = {}, throwOnError = false } = config;
  
  const finalBaseUrl = baseUrl || getManagementBaseUrl(region, 'https');
  
  return createClient({
    baseUrl: finalBaseUrl,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(token),
      ...headers
    },
    throwOnError: throwOnError ?? false
  });
}

function getAuthHeader(token: PersonalAccessToken | OAuthToken): Record<string, string> {
  return 'accessToken' in token ? {
    'Authorization': token.accessToken
  } : {
    'Authorization': token.oauthToken
  }
}

// Export client utilities
export { createClient } from './client';
export type { Client } from './client/types';

// Export all generated types
export * from './types.generated';

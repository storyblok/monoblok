// Import generated SDKs with shared client support
import { createClient } from './client';
import type { Client } from './client/types';

import { getManagementBaseUrl, type Region } from '@storyblok/region-helper';
import { RateLimiter, type RateLimitConfig } from './client/rateLimiter';

// Import the generated registry
import { sdkRegistry, SdkRegistry, SdkRegistryInstance } from './sdk-registry.generated';


type PersonalAccessToken = {
  accessToken: string;
}

type OAuthToken = {
  oauthToken: string;
}

export interface MapiClientConfig<ThrowOnError extends boolean = false> {
  token: PersonalAccessToken | OAuthToken;
  region?: Region;
  baseUrl?: string; // Override for custom endpoints
  headers?: Record<string, string>;
  throwOnError?: ThrowOnError;
  rateLimiting?: RateLimitConfig;
}

export interface MapiClient<ThrowOnError extends boolean = false> extends SdkRegistryInstance {}

export class MapiClient<ThrowOnError extends boolean = false> {
  private client: Client;
  private config: MapiClientConfig<ThrowOnError>;
  private rateLimiter: RateLimiter;
  
  // Index signature for dynamic SDK properties
  [key: string]: any;

  constructor(config: MapiClientConfig<ThrowOnError>) {
    this.config = config;
    const { token, region = "eu", baseUrl, headers = {}, throwOnError = false, rateLimiting } = config;
    
    // Initialize the rate limiter for this client instance
    this.rateLimiter = new RateLimiter(rateLimiting);
    
    // Determine the base URL
    const finalBaseUrl = baseUrl || getManagementBaseUrl(region, 'https');
    
    // Create a single shared client instance for all resources
    this.client = createClient({
      baseUrl: finalBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(token),
        ...headers
      },
      throwOnError: throwOnError ?? false
    });
    
    // Add rate limiting interceptor
    this.setupRateLimitingInterceptor();

    // Create resource SDKs using the shared client instance and registry
    for (const [name, SdkClass] of Object.entries(sdkRegistry)) {
      // @ts-expect-error - this is a dynamic property
      this[name as keyof SdkRegistry] = new (SdkClass as any)({ client: this.client, throwOnError: throwOnError ?? false });
    }
  }

  private getAuthHeader(token: PersonalAccessToken | OAuthToken): Record<string, string> {
    return 'accessToken' in token ? {
      'Authorization': token.accessToken
    } : {
      'Authorization': token.oauthToken
    }
  }

  private setupRateLimitingInterceptor(): void {
    // Intercept requests to add rate limiting and 429 retry logic at fetch level
    this.client.interceptors.request.use(async (request, options) => {
      // Wrap the actual fetch call with rate limiting and retry logic
      const originalFetch = options.fetch || globalThis.fetch;
      
      options.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        return this.rateLimiter.execute(() => 
          this.fetchWithRetry(originalFetch as typeof fetch, input, init)
        );
      };
      
      return request;
    });
  }

  private async fetchWithRetry(
    fetchFn: typeof fetch, 
    input: RequestInfo | URL, 
    init?: RequestInit,
    attempt: number = 0
  ): Promise<Response> {
    const response = await fetchFn(input, init);
    
    // Check for 429 status and retry if within limits  
    // attempt starts at 0, so attempt < maxRetries means we retry up to maxRetries times
    if (response.status === 429 && attempt < this.rateLimiter.getMaxRetries()) {
      // Extract retry-after header if available
      const retryAfter = response.headers.get('retry-after');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.rateLimiter.getRetryDelay();
      
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Clone the request for retry (body can only be read once)
      const retryInput = input instanceof Request ? input.clone() : input;
      const retryInit = init ? { ...init } : undefined;
      
      return this.fetchWithRetry(fetchFn, retryInput, retryInit, attempt + 1);
    }
    
    return response;
  }

  // Method to update configuration at runtime
  setConfig(config: Partial<Omit<MapiClientConfig, 'token'>>): void {
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
          ...this.getAuthHeader(this.config.token),
          ...headers
        }
      });
    }
  }

  // Method to update token
  setToken(token: PersonalAccessToken | OAuthToken): void {
    this.config.token = token;
    this.client.setConfig({
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(token),
        ...this.config.headers
      }
    });
  }

  // Method to update rate limiting configuration
  setRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimiter.updateConfig(config);
  }

  // Method to get rate limiting stats
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }
}

// Export client utilities
export { createClient } from './client';
export type { Client } from './client/types';
export type { RateLimitConfig } from './client/rateLimiter';

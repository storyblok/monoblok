// Import generated SDKs with shared client support
import { createClient } from './client';
import { Sdk as DatasourcesSdk } from './generated/datasources/sdk.gen';
import { Sdk as StoriesSdk } from './generated/stories/sdk.gen';
import { Sdk as ComponentsSdk } from './generated/components/sdk.gen';
import { Sdk as DatasourceEntriesSdk } from './generated/datasource_entries/sdk.gen';
import { Sdk as InternalTagsSdk } from './generated/internal_tags/sdk.gen';
import { Sdk as SpacesSdk } from './generated/spaces/sdk.gen';
import type { Client } from './client/types';

import { getManagementBaseUrl, type Region } from '@storyblok/region-helper';

type PersonalAccessToken = {
  accessToken: string;
}

type OAuthToken = {
  oauthToken: string;
}

export interface MapiClientConfig {
  token: PersonalAccessToken | OAuthToken;
  region?: Region;
  baseUrl?: string; // Override for custom endpoints
  headers?: Record<string, string>;
  throwOnError?: boolean;
}
export class MapiClient {
  private client: Client;
  private config: MapiClientConfig;
  
  public datasources: DatasourcesSdk;
  public stories: StoriesSdk;
  public components: ComponentsSdk;
  public datasourceEntries: DatasourceEntriesSdk;
  public internalTags: InternalTagsSdk;
  public spaces: SpacesSdk;

  constructor(config: MapiClientConfig) {
    this.config = config;
    const { token, region = "eu", baseUrl, headers = {}, throwOnError = false } = config;
    
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
      throwOnError
    });
    
    // Create resource SDKs using the shared client instance
    this.datasources = new DatasourcesSdk({ client: this.client });
    this.stories = new StoriesSdk({ client: this.client });
    this.components = new ComponentsSdk({ client: this.client });
    this.datasourceEntries = new DatasourceEntriesSdk({ client: this.client });
    this.internalTags = new InternalTagsSdk({ client: this.client });
    this.spaces = new SpacesSdk({ client: this.client });
  }

  private getAuthHeader(token: PersonalAccessToken | OAuthToken): Record<string, string> {
    return 'accessToken' in token ? {
      'Authorization': token.accessToken
    } : {
      'Authorization': token.oauthToken
    }
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
}

// Export types from all resources (using namespace to avoid conflicts)
export * as DatasourcesTypes from './generated/datasources/types.gen';
export * as StoriesTypes from './generated/stories/types.gen';
export * as ComponentsTypes from './generated/components/types.gen';
export * as DatasourceEntriesTypes from './generated/datasource_entries/types.gen';
export * as InternalTagsTypes from './generated/internal_tags/types.gen';
export * as SpacesTypes from './generated/spaces/types.gen';

// Export the SDKs for advanced usage
export { Sdk as DatasourcesSdk } from './generated/datasources/sdk.gen';
export { Sdk as StoriesSdk } from './generated/stories/sdk.gen';
export { Sdk as ComponentsSdk } from './generated/components/sdk.gen';
export { Sdk as DatasourceEntriesSdk } from './generated/datasource_entries/sdk.gen';
export { Sdk as InternalTagsSdk } from './generated/internal_tags/sdk.gen';
export { Sdk as SpacesSdk } from './generated/spaces/sdk.gen';

// Export client utilities
export { createClient } from './client';
export type { Client } from './client/types';


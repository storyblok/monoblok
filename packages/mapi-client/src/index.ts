// Dynamic imports for all generated resource clients
import { client as datasourcesClient } from './generated/datasources/client.gen';
import * as datasourcesSdk from './generated/datasources/sdk.gen';
import * as storiesSdk from './generated/stories/sdk.gen';
import * as componentsSdk from './generated/components/sdk.gen';
import * as datasourceEntriesSdk from './generated/datasource_entries/sdk.gen';
import * as internalTagsSdk from './generated/internal_tags/sdk.gen';

export interface MapiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

// Type-safe resource wrapper that preserves method signatures
type ResourceWrapper<TSdk extends Record<string, any>> = {
  [K in keyof TSdk as TSdk[K] extends (...args: any[]) => any ? K : never]: 
    TSdk[K] extends (options: infer Options) => any
      ? (options: Omit<Options, 'client'>) => ReturnType<TSdk[K]>
      : TSdk[K];
};

// Helper function to create type-safe resource wrappers
function createResourceWrapper<TSdk extends Record<string, any>>(
  sdk: TSdk,
  client: any
): ResourceWrapper<TSdk> {
  const wrapper = {} as ResourceWrapper<TSdk>;
  
  // Get all exported functions from the SDK
  const sdkExports = Object.keys(sdk).filter(key => 
    typeof sdk[key] === 'function'
  );

  // Create a wrapper for each method with proper typing
  sdkExports.forEach(methodName => {
    (wrapper as any)[methodName] = (options: any) => {
      const sdkMethod = sdk[methodName];
      return sdkMethod({ ...options, client });
    };
  });

  return wrapper;
}

export class MapiClient {
  private client: any;
  
  public datasources: ResourceWrapper<typeof datasourcesSdk>;
  public stories: ResourceWrapper<typeof storiesSdk>;
  public components: ResourceWrapper<typeof componentsSdk>;
  public datasourceEntries: ResourceWrapper<typeof datasourceEntriesSdk>;
  public internalTags: ResourceWrapper<typeof internalTagsSdk>;

  constructor(config: MapiClientConfig = {}) {
    const { baseUrl, headers = {} } = config;
    
    // Use a single client instance for all resources
    this.client = datasourcesClient;
    
    // Configure the client with custom baseUrl if provided
    if (baseUrl) {
      this.client.setConfig({ baseUrl });
    }
    
    // Add custom headers
    if (Object.keys(headers).length > 0) {
      this.client.setConfig({ headers });
    }
    
    // Create resource wrappers using the same client
    this.datasources = createResourceWrapper(datasourcesSdk, this.client);
    this.stories = createResourceWrapper(storiesSdk, this.client);
    this.components = createResourceWrapper(componentsSdk, this.client);
    this.datasourceEntries = createResourceWrapper(datasourceEntriesSdk, this.client);
    this.internalTags = createResourceWrapper(internalTagsSdk, this.client);
  }

  // Method to update configuration at runtime
  setConfig(config: Partial<MapiClientConfig>): void {
    const { baseUrl, headers } = config;
    
    if (baseUrl) {
      this.client.setConfig({ baseUrl });
    }
    
    if (headers) {
      this.client.setConfig({ headers });
    }
  }
}

// Export types from all resources (using namespace to avoid conflicts)
export * as DatasourcesTypes from './generated/datasources/types.gen';
export * as StoriesTypes from './generated/stories/types.gen';
export * as ComponentsTypes from './generated/components/types.gen';
export * as DatasourceEntriesTypes from './generated/datasource_entries/types.gen';
export * as InternalTagsTypes from './generated/internal_tags/types.gen';
export * as MapiTypes from './generated/mapi/types.gen';


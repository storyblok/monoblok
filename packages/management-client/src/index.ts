import type { RegionCode } from './utils/region';
import { regions } from './utils/region';

export interface StoryblokManagementClientOptions {
  token: string;
  region?: RegionCode;
}

export interface StoryblokManagementClientState {
  token: string | null;
  headers: Headers;
  region?: RegionCode;
}

export interface StoryblokManagementClient {
  uuid: string;
  init: (clientOptions: StoryblokManagementClientOptions) => void;
}

// Singleton instance for managementClient function
let singletonInstance: StoryblokManagementClient | null = null;

/**
 * Creates a new management client instance every time it's called
 * @param clientOptions - Configuration options for the client
 * @returns A new StoryblokManagementClient instance
 */
export const createManagementClient = (clientOptions: StoryblokManagementClientOptions): StoryblokManagementClient => {
  if (!clientOptions?.token) {
    throw new Error('Management API Client requires an access token for initialization');
  }

  const state: StoryblokManagementClientState = {
    token: null,
    headers: new Headers(),
    region: regions.EU,
  };

  const init = (clientOptions: StoryblokManagementClientOptions) => {
    state.token = clientOptions.token;
    state.region = clientOptions.region;
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': clientOptions.token,
    };

    state.headers = new Headers(baseHeaders);
  };

  // Always create a new instance
  const instance: StoryblokManagementClient = {
    uuid: `management-client-${Math.random().toString(36).substring(2, 15)}`,
    init,
  };

  // Initialize the instance immediately
  init(clientOptions);

  return instance;
};

/**
 * Returns a singleton management client instance
 * Creates the instance on first call, returns the same instance on subsequent calls
 * @param clientOptions - Configuration options for the client (only used on first call)
 * @returns The singleton StoryblokManagementClient instance
 */
export const managementClient = (clientOptions?: StoryblokManagementClientOptions): StoryblokManagementClient => {
  if (!singletonInstance) {
    if (!clientOptions?.token) {
      throw new Error('Management API Client requires an access token for initialization on first call');
    }
    singletonInstance = createManagementClient(clientOptions);
  }

  return singletonInstance;
};

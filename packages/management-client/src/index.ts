import type { FetchOptions, GetResponse, StoryblokManagementClient, StoryblokManagementClientOptions, StoryblokManagementClientState } from './types';
import { getManagementApiUrl } from './utils/region';

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
    headers: {},
    url: getManagementApiUrl(clientOptions.region || 'eu'),
    region: clientOptions.region || 'eu',
  };

  const request = async <T>(path: string, fetchOptions?: FetchOptions): Promise<GetResponse<T>> => {
    const { headers, method, body } = fetchOptions || {};

    const requestData = {
      path,
      method: method || 'GET',
      headers: {
        ...state.headers,
        ...headers,
      },
      body,
    };

    const res = await fetch(`${state.url}/${path}`, {
      headers: requestData.headers as HeadersInit,
      ...fetchOptions,
    });

    let data;
    try {
      data = await res.json();
    }
    catch {
      throw new Error('Non-JSON response');
    }

    if (res.ok) {
      if (clientOptions?.verbose) {
        // eslint-disable-next-line no-console
        console.log(`✅ ${path}`);
      }
      return {
        data,
        attempt: 1,
      };
    }
    else {
      throw new Error('Request failed');
    }
  };

  const init = (clientOptions: StoryblokManagementClientOptions) => {
    state.token = clientOptions.token;
    state.region = clientOptions.region;
    state.verbose = clientOptions.verbose || false;
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': clientOptions.token,
    };

    state.headers = baseHeaders;
  };

  // Always create a new instance
  const instance: StoryblokManagementClient = {
    uuid: `management-client-${Math.random().toString(36).substring(2, 15)}`,
    init,
    request,
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

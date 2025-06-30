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

export const createManagementClient = () => {
  let instance: StoryblokManagementClient | null = null;

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
    instance = {
      uuid: `management-client-${Math.random().toString(36).substring(2, 15)}`,
      init,
    };

    return instance;
  };

  return (clientOptions?: StoryblokManagementClientOptions): StoryblokManagementClient => {
    if (!instance) {
      if (!clientOptions?.token) {
        throw new Error('Management API Client requires an access token for initialization');
      }
      instance = init(clientOptions);
    }
    return instance;
  };
};

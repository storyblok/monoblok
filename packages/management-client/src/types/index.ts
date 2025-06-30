import type { RegionCode } from '../utils/region';

export interface StoryblokManagementClientOptions {
  token: string;
  region?: RegionCode;
  verbose?: boolean;
}

export interface StoryblokManagementClientState {
  token: string | null;
  headers: Record<string, string>;
  region?: RegionCode;
  url: string;
  verbose?: boolean;
}

export interface StoryblokManagementClient {
  uuid: string;
  init: (clientOptions: StoryblokManagementClientOptions) => void;
  request: <T>(path: string, fetchOptions?: FetchOptions) => Promise<GetResponse<T>>;
}

export interface GetResponse<T> {
  data: T;
  attempt: number;
}

export interface FetchOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: any;
  maxRetries?: number;
  baseDelay?: number;
}

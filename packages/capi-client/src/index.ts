import { createClient, createConfig } from './generated/client';
import { get, getAll } from './generated/sdk.gen';
import type { GetAllData, GetAllResponses, GetData, GetResponses } from './generated/types.gen';
import type { StoryCapi } from './generated';
import { getRegionBaseUrl, type Region } from '@storyblok/region-helper';
import type { Client } from './generated/client';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Story = Prettify<StoryCapi>;

// Helper type to replace StoryCapi with Story in response types
type ReplaceStory<T> = T extends StoryCapi
  ? Story
  : T extends Array<StoryCapi>
    ? Array<Story>
    : T extends Array<infer U>
      ? Array<ReplaceStory<U>>
      : T extends object
        ? { [K in keyof T]: ReplaceStory<T[K]> }
        : T;

// Transform response types to use Story instead of StoryCapi
type GetResponse = ReplaceStory<GetResponses[200]>;
type GetAllResponse = ReplaceStory<GetAllResponses[200]>;

type ApiResponse<T> =
  | { data: T; error: undefined; response: Response; request: Request }
  | { data: undefined; error: unknown; response: Response; request: Request };

export interface ContentApiClientConfig<ThrowOnError extends boolean = false> {
  accessToken: string;
  region?: Region;
  baseUrl?: string;
  headers?: Record<string, string>;
  throwOnError?: ThrowOnError;
}

export const createApiClient = <ThrowOnError extends boolean = false>(
  config: ContentApiClientConfig<ThrowOnError>,
) => {
  const { accessToken, region = 'eu', baseUrl, headers = {}, throwOnError = false } = config;
  const client: Client = createClient(
    createConfig({
      baseUrl: baseUrl || getRegionBaseUrl(region, 'https'),
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      throwOnError,
    }),
  );

  /**
   * Retrieve a single story
   * @param identifier - Story identifier - can be full_slug (string), id (number), or uuid (string). When using uuid, the find_by=uuid query parameter is required.
   * @param query - Query parameters for the request
   */
  const getStory = async (
    identifier: GetData['path']['identifier'],
    query: Prettify<Omit<GetData['query'], 'token'>> = {},
  ): Promise<ApiResponse<GetResponse>> => {
    return get({ client, path: { identifier }, query: { ...query, token: accessToken } });
  };

  /**
   * Retrieve multiple stories
   * @param query - Query parameters for filtering and pagination
   */
  const getAllStories = async (
    query: Prettify<Omit<GetAllData['query'], 'token'>> = {},
  ): Promise<ApiResponse<GetAllResponse>> => {
    return getAll({ client, query: { ...query, token: accessToken } });
  };

  const stories = {
    get: getStory,
    getAll: getAllStories,
  };

  return {
    stories,
  };
};

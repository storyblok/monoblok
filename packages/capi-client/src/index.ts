import { createClient, createConfig } from './generated/client';
import { get, getAll } from './generated/sdk.gen';
import type { GetAllData, GetAllResponses, GetData, GetResponses } from './generated/types.gen';
import type { StoryCapi } from './generated';
import { getRegionBaseUrl, type Region } from '@storyblok/region-helper';
import type { Client, RequestOptions } from './generated/client';

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

type GenericRequestOptions<ThrowOnError extends boolean = false> = Omit<
  RequestOptions<unknown, 'fields', ThrowOnError>,
  'method' | 'security' | 'throwOnError' | 'url'
>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type GenericRequestMethod<ThrowOnError extends boolean = false> = <TData = unknown>(
  path: string,
  options?: GenericRequestOptions<ThrowOnError>,
) => Promise<ApiResponse<TData>>;

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
      auth: accessToken,
      baseUrl: baseUrl || getRegionBaseUrl(region),
      headers,
      throwOnError,
      kyOptions: {
        // Enable `throwHttpErrors` to make retry work, even if `throwOnError`
        // is `false`. The client's error handling will still work because it
        // catches `HTTPError`.
        throwHttpErrors: true,
        timeout: 30_000,
        retry: {
          limit: 3,
          backoffLimit: 20_000,
          jitter: true,
        },
      },
    }),
  );

  const security = [
    {
      in: 'query' as const,
      name: 'token',
      type: 'apiKey' as const,
    },
  ];

  const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

  const request = async <TData = unknown, TError = unknown>(
    method: HttpMethod,
    path: string,
    options: GenericRequestOptions<ThrowOnError> = {},
  ): Promise<ApiResponse<TData>> => {
    return client.request<TData, TError, ThrowOnError>({
      ...options,
      method,
      security,
      url: normalizePath(path),
    }) as Promise<ApiResponse<TData>>;
  };

  const createMethod = (method: HttpMethod): GenericRequestMethod<ThrowOnError> => {
    return <TData = unknown>(
      path: string,
      options: GenericRequestOptions<ThrowOnError> = {},
    ) => {
      return request<TData>(method, path, options);
    };
  };

  /**
   * Retrieve a single story
   * @param identifier - Story identifier - can be full_slug (string), id (number), or uuid (string). When using uuid, the find_by=uuid query parameter is required.
   * @param query - Query parameters for the request
   */
  const getStory = async (
    identifier: GetData['path']['identifier'],
    query: Prettify<Omit<GetData['query'], 'token'>> = {},
  ): Promise<ApiResponse<GetResponse>> => {
    return get({ client, path: { identifier }, query });
  };

  /**
   * Retrieve multiple stories
   * @param query - Query parameters for filtering and pagination
   */
  const getAllStories = async (
    query: Prettify<Omit<GetAllData['query'], 'token'>> = {},
  ): Promise<ApiResponse<GetAllResponse>> => {
    return getAll({ client, query });
  };

  const stories = {
    get: getStory,
    getAll: getAllStories,
  };

  const getRequest = createMethod('GET');
  const postRequest = createMethod('POST');
  const putRequest = createMethod('PUT');
  const patchRequest = createMethod('PATCH');
  const deleteRequest = createMethod('DELETE');

  return {
    delete: deleteRequest,
    get: getRequest,
    patch: patchRequest,
    post: postRequest,
    put: putRequest,
    stories,
  };
};

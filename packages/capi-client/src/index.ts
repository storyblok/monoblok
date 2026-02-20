import { createClient, createConfig } from './generated/client';
import { get, getAll } from './generated/sdk.gen';
import type { GetAllData, GetAllResponses, GetData, GetResponses } from './generated/types.gen';
import type { StoryCapi } from './generated';
import type { CacheProvider, CacheStrategy } from './cache';
import { createMemoryCacheProvider } from './cache';
import { applyCvToQuery, extractCv } from './utils/cv';
import { createCacheKey, isCdnPath, isDraftRequest, normalizePath, shouldUseCache, toQueryRecord } from './utils/request';
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

interface CacheConfig {
  provider?: CacheProvider;
  strategy?: CacheStrategy;
  ttlMs?: number;
  maxEntries?: number;
}

export interface ContentApiClientConfig<ThrowOnError extends boolean = false> {
  accessToken: string;
  region?: Region;
  baseUrl?: string;
  headers?: Record<string, string>;
  throwOnError?: ThrowOnError;
  cache?: CacheConfig;
}

export const createApiClient = <ThrowOnError extends boolean = false>(
  config: ContentApiClientConfig<ThrowOnError>,
) => {
  const {
    accessToken,
    region = 'eu',
    baseUrl,
    headers = {},
    throwOnError = false,
    cache = {},
  } = config;
  const cacheProvider = cache.provider ?? createMemoryCacheProvider({
    maxEntries: cache.maxEntries,
  });
  const cacheStrategy = cache.strategy ?? 'cache-first';
  const cacheTtlMs = cache.ttlMs ?? 60_000;
  const revalidations = new Map<string, Promise<void>>();
  const swrCache = cacheStrategy === 'swr'
    ? new Map<string, ApiResponse<unknown>>()
    : undefined;
  let currentCv: number | undefined;

  const flushCaches = async () => {
    await cacheProvider.flush();
    swrCache?.clear();
  };

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

  const updateCv = async (path: string, query: Record<string, unknown>, result: ApiResponse<unknown>) => {
    if (!isCdnPath(path) || isDraftRequest(query)) {
      return;
    }

    const nextCv = extractCv(result);
    if (nextCv === undefined) {
      return;
    }

    if (currentCv !== undefined && currentCv !== nextCv) {
      await flushCaches();
    }

    currentCv = nextCv;
  };

  const requestNetwork = async <TData = unknown, TError = unknown>(
    method: HttpMethod,
    path: string,
    query: Record<string, unknown>,
    options: GenericRequestOptions<ThrowOnError>,
  ): Promise<ApiResponse<TData>> => {
    return client.request<TData, TError, ThrowOnError>({
      ...options,
      method,
      query,
      security,
      url: path,
    }) as Promise<ApiResponse<TData>>;
  };

  const handleCacheFirst = async <TData>(
    cachedResult: ApiResponse<TData> | undefined,
    loadNetwork: () => Promise<ApiResponse<TData>>,
  ): Promise<ApiResponse<TData>> => {
    if (cachedResult) {
      return cachedResult;
    }

    return loadNetwork();
  };

  const handleNetworkFirst = async <TData>(
    cachedResult: ApiResponse<TData> | undefined,
    loadNetwork: () => Promise<ApiResponse<TData>>,
  ): Promise<ApiResponse<TData>> => {
    try {
      return await loadNetwork();
    }
    catch (error) {
      // network-first: try network, fall back to cached data if available.
      // Since the provider evicts expired entries, this only falls back to
      // fresh cached data. If no fresh data is available, the error propagates.
      if (cachedResult) {
        return cachedResult;
      }

      throw error;
    }
  };

  const handleSwr = async <TData>(
    key: string,
    cachedResult: ApiResponse<TData> | undefined,
    staleResult: ApiResponse<TData> | undefined,
    loadNetwork: () => Promise<ApiResponse<TData>>,
  ): Promise<ApiResponse<TData>> => {
    if (cachedResult) {
      return cachedResult;
    }

    if (staleResult) {
      if (!revalidations.has(key)) {
        const revalidation = loadNetwork()
          .then(() => undefined)
          .catch(() => undefined)
          .finally(() => {
            revalidations.delete(key);
          });
        revalidations.set(key, revalidation);
      }

      return staleResult;
    }

    return loadNetwork();
  };

  const requestWithCache = async <TData = unknown>(
    method: HttpMethod,
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData>>,
  ): Promise<ApiResponse<TData>> => {
    const query = applyCvToQuery(path, rawQuery, currentCv);
    const cacheEnabled = shouldUseCache(method, path, rawQuery);

    if (!cacheEnabled) {
      const networkResult = await fetchFn(query);
      await updateCv(path, rawQuery, networkResult as ApiResponse<unknown>);
      return networkResult;
    }

    const key = createCacheKey(method, path, rawQuery);
    const cachedEntry = await cacheProvider.get(key);
    const cachedResult = cachedEntry?.value as ApiResponse<TData> | undefined;

    const cacheSuccessResult = async (result: ApiResponse<TData>) => {
      await updateCv(path, rawQuery, result as ApiResponse<unknown>);
      if (result.error === undefined) {
        await cacheProvider.set(key, {
          value: result,
          storedAt: Date.now(),
          ttlMs: cacheTtlMs,
        });
        swrCache?.set(key, result as ApiResponse<unknown>);
      }
      return result;
    };

    const loadNetwork = async () => {
      const result = await fetchFn(query);
      return cacheSuccessResult(result);
    };

    if (cacheStrategy === 'network-first') {
      return handleNetworkFirst(cachedResult, loadNetwork);
    }

    if (cacheStrategy === 'swr') {
      const staleResult = swrCache?.get(key) as ApiResponse<TData> | undefined;
      return handleSwr(key, cachedResult, staleResult, loadNetwork);
    }

    return handleCacheFirst(cachedResult, loadNetwork);
  };

  const request = async <TData = unknown, TError = unknown>(
    method: HttpMethod,
    rawPath: string,
    options: GenericRequestOptions<ThrowOnError> = {},
  ): Promise<ApiResponse<TData>> => {
    const path = normalizePath(rawPath);
    const rawQuery = toQueryRecord(options.query);

    return requestWithCache<TData>(method, path, rawQuery, (query) => {
      return requestNetwork<TData, TError>(method, path, query, options);
    });
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
    query: GetData['query'] = {},
  ): Promise<ApiResponse<GetResponse>> => {
    const requestPath = `/v2/cdn/stories/${identifier}`;
    const rawQuery = toQueryRecord(query);
    return requestWithCache<GetResponse>('GET', requestPath, rawQuery, (requestQuery) => {
      return get({
        client,
        path: { identifier },
        query: requestQuery,
      });
    });
  };

  /**
   * Retrieve multiple stories
   * @param query - Query parameters for filtering and pagination
   */
  const getAllStories = async (
    query: GetAllData['query'] = {},
  ): Promise<ApiResponse<GetAllResponse>> => {
    const requestPath = '/v2/cdn/stories';
    const rawQuery = toQueryRecord(query);
    return requestWithCache<GetAllResponse>('GET', requestPath, rawQuery, (requestQuery) => {
      return getAll({
        client,
        query: requestQuery,
      });
    });
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

  const cacheApi = {
    clearCv: () => {
      currentCv = undefined;
    },
    flush: async () => {
      await flushCaches();
      currentCv = undefined;
    },
    getCv: () => currentCv,
    setCv: (cv: number) => {
      currentCv = cv;
    },
  };

  return {
    cache: cacheApi,
    delete: deleteRequest,
    get: getRequest,
    patch: patchRequest,
    post: postRequest,
    put: putRequest,
    stories,
  };
};

export type { CacheProvider, CacheStrategy };

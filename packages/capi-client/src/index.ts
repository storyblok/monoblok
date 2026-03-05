import { createClient, createConfig } from './generated/shared/client';
import type { StoryCapi } from './generated/stories';
import type { CacheProvider, CacheStrategy, CacheStrategyHandler } from './utils/cache';
import { createMemoryCacheProvider, createStrategy } from './utils/cache';
import { ClientError } from './error';
import type { RateLimitConfig } from './utils/rate-limit';
import { createThrottleManager } from './utils/rate-limit';
import { applyCvToQuery, extractCv } from './utils/cv';
import { createCacheKey, shouldUseCache } from './utils/request';
import { getRegionBaseUrl, type Region } from '@storyblok/region-helper';
import type { RetryOptions } from 'ky';
import type { Client, ResolvedRequestOptions } from './generated/shared/client';
import type { Middleware } from './generated/shared/client/utils.gen';
import type { ApiResponse, HttpRequestMethod, HttpRequestOptions, ResourceDeps } from './types';
import { createStoriesResource } from './resources/stories';
import { createLinksResource } from './resources/links';
import { createTagsResource } from './resources/tags';
import { createDatasourcesResource } from './resources/datasources';
import { createDatasourceEntriesResource } from './resources/datasource-entries';
import { createSpacesResource } from './resources/spaces';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Story = Prettify<StoryCapi>;
export { ClientError } from './error';
export type { DatasourceEntryCapi as DatasourceEntry } from './generated/datasource_entries/types.gen';
export type { DatasourceCapi as Datasource } from './generated/datasources/types.gen';
export type { LinkCapi as Link } from './generated/links/types.gen';
export type { Middleware } from './generated/shared/client/utils.gen';
export type { SpaceCapi as Space } from './generated/spaces/types.gen';
export type { ApiResponse, HttpRequestMethod, HttpRequestOptions };
export type { CacheProvider, CacheStrategy, CacheStrategyHandler };
export type { RateLimitConfig };
export type { TagCapi as Tag } from './generated/tags/types.gen';
export type { StoryWithInlinedRelations } from './resources/stories';

export { createThrottle, parseRateLimitPolicyHeader } from './utils/rate-limit';

interface CacheConfig {
  provider?: CacheProvider;
  strategy?: CacheStrategy | CacheStrategyHandler;
  ttlMs?: number;
  /**
   * Controls when the cache is flushed on cv change.
   *
   * - `'auto'` (default): automatically flush the cache whenever the API returns a new cv value.
   * - `'manual'`: never auto-flush; call `client.flushCache()` explicitly (e.g. on webhook trigger).
   */
  flush?: 'auto' | 'manual';
}

export interface ContentApiClientConfig<
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
> {
  accessToken: string;
  region?: Region;
  baseUrl?: string;
  headers?: Record<string, string>;
  throwOnError?: ThrowOnError;
  cache?: CacheConfig;
  inlineRelations?: InlineRelations;
  retry?: RetryOptions;
  /**
   * Request timeout in milliseconds.
   * @default 30_000
   */
  timeout?: number;
  /**
   * Preventive rate limiting to avoid hitting the Storyblok CDN rate limits.
   *
   * - `undefined` (default): auto-detect tier from path + `per_page` query param.
   * - `number`: fixed max concurrent requests per second (single queue).
   * - `{ maxConcurrent?: number; adaptToServerHeaders?: boolean }`: full config.
   * - `false`: disable rate limiting entirely.
   */
  rateLimit?: RateLimitConfig | number | false;
}

export const createApiClient = <
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
>(
  config: ContentApiClientConfig<ThrowOnError, InlineRelations>,
) => {
  const {
    accessToken,
    region = 'eu',
    baseUrl,
    headers = {},
    throwOnError = false,
    cache = {},
    inlineRelations = false,
    retry,
    timeout = 30_000,
    rateLimit,
  } = config;
  const retryOptions: RetryOptions = { limit: 3, backoffLimit: 20_000, jitter: true, ...retry };
  // `rateLimit` defaults to `{}` (auto-detect mode) when not supplied.
  const throttleManager = createThrottleManager(rateLimit ?? {});
  const cacheProvider = cache.provider ?? createMemoryCacheProvider();
  const strategy = cache.strategy
    ? typeof cache.strategy === 'string'
      ? createStrategy(cache.strategy)
      : cache.strategy
    : createStrategy('cache-first');
  const cacheTtlMs = cache.ttlMs ?? 60_000;
  const cacheFlush = cache.flush ?? 'auto';
  let currentCv: number | undefined;

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
        timeout,
        retry: retryOptions,
      },
    }),
  );

  client.interceptors.error.use(
    (error: unknown, response: Response) =>
      new ClientError(response?.statusText || 'API request failed', {
        status: response?.status ?? 0,
        statusText: response?.statusText ?? '',
        data: error,
      }),
  );

  const security = [
    {
      in: 'query' as const,
      name: 'token',
      type: 'apiKey' as const,
    },
  ];

  const updateCv = async (result: ApiResponse<unknown>): Promise<boolean> => {
    const nextCv = extractCv(result.data);
    if (nextCv === undefined) {
      return true;
    }

    // Guard against cv regression: SWR background revalidation may carry a
    // stale cv from a prior request; never move cv backward.
    if (currentCv !== undefined && nextCv < currentCv) {
      return false;
    }

    if (cacheFlush === 'auto' && currentCv !== undefined && currentCv !== nextCv) {
      await cacheProvider.flush();
    }

    currentCv = nextCv;
    return true;
  };

  const cacheSuccessResult = async <TResponse extends ApiResponse<unknown>>(key: string, result: TResponse) => {
    const shouldCacheResult = await updateCv(result);
    if (result.error === undefined && shouldCacheResult) {
      await cacheProvider.set(key, {
        value: result,
        ttlMs: cacheTtlMs,
      });
    }
    return result;
  };

  const requestNetwork = async <TData = unknown, TError = unknown>(
    method: 'GET',
    path: string,
    query: Record<string, unknown>,
    options: HttpRequestOptions,
  ): Promise<ApiResponse<TData>> => {
    return client.request<TData, TError, boolean>({
      ...options,
      method,
      query,
      security,
      url: path,
      // The error interceptor transforms errors into ClientError instances at
      // runtime, but the generated types still report `error: unknown`. Cast
      // here so the rest of the codebase sees the narrowed type.
    }) as unknown as Promise<ApiResponse<TData>>;
  };

  /**
   * Wraps a raw SDK call to cast the `error: unknown` type returned by
   * generated code to `ClientError` — the error interceptor ensures the
   * runtime value IS a ClientError.
   */
  const asApiResponse = <TData, ThrowOnError extends boolean = false>(
    p: Promise<unknown>,
  ): Promise<ApiResponse<TData, ThrowOnError>> => p as unknown as Promise<ApiResponse<TData, ThrowOnError>>;

  const requestWithCache = async <TData = unknown, ThrowOnError extends boolean = false>(
    method: 'GET',
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData, ThrowOnError>>,
    options: { throttle?: boolean } = {},
  ): Promise<ApiResponse<TData, ThrowOnError>> => {
    const query = currentCv !== undefined ? applyCvToQuery(rawQuery, currentCv) : rawQuery;
    const cacheEnabled = shouldUseCache(method, path, rawQuery);
    const useThrottle = options.throttle ?? true;

    const loadNetworkResult = async () => {
      return useThrottle
        ? throttleManager.execute(path, rawQuery, () => fetchFn(query))
        : fetchFn(query);
    };

    if (!cacheEnabled) {
      const networkResult = await loadNetworkResult();
      throttleManager.adaptToResponse(networkResult.response);
      // widen conditional generic — updateCv only reads cv, TData irrelevant
      await updateCv(networkResult as ApiResponse<unknown>);
      return networkResult;
    }

    const key = createCacheKey(method, path, rawQuery);
    const cachedEntry = await cacheProvider.get<ApiResponse<TData>>(key);
    const cachedResult = cachedEntry?.value;

    const loadNetwork = async () => {
      const result = await loadNetworkResult();
      throttleManager.adaptToResponse(result.response);
      // drop ThrowOnError for cache storage; value is restored after strategy returns
      return cacheSuccessResult(key, result as ApiResponse<TData>);
    };

    return strategy({
      key,
      cachedResult,
      loadNetwork,
    }) as Promise<ApiResponse<TData, ThrowOnError>>; // restore ThrowOnError erased by the generic CacheStrategyHandler
  };

  const request = async <TData = unknown, TError = unknown>(
    method: 'GET',
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData>> => {
    const rawQuery = options.query || {};

    return requestWithCache<TData>(method, path, rawQuery, (query) => {
      return requestNetwork<TData, TError>(method, path, query, options);
    });
  };

  const getRequest: HttpRequestMethod = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ) => {
    return request<TData>('GET', path, options);
  };

  const resourceDeps: ResourceDeps = {
    client,
    requestWithCache,
    asApiResponse,
  };

  const stories = createStoriesResource<InlineRelations>({
    ...resourceDeps,
    inlineRelations,
    throttleManager,
  });

  /**
   * Flush the in-memory cache and reset the tracked cv.
   *
   * Call this explicitly when `cache.flush` is set to `'manual'`, e.g. after
   * receiving a Storyblok webhook event that signals content has changed.
   */
  const flushCache = async (): Promise<void> => {
    await cacheProvider.flush();
    currentCv = undefined;
  };

  return {
    datasourceEntries: createDatasourceEntriesResource(resourceDeps),
    datasources: createDatasourcesResource(resourceDeps),
    flushCache,
    get: getRequest,
    // generated client type is broader; narrow for public API surface
    interceptors: client.interceptors as Middleware<Request, Response, unknown, ResolvedRequestOptions>,
    links: createLinksResource(resourceDeps),
    spaces: createSpacesResource(resourceDeps),
    stories,
    tags: createTagsResource(resourceDeps),
  };
};

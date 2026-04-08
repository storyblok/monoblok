import { createClient, createConfig } from './generated/shared/client';
import type { CacheProvider, CacheStrategy, CacheStrategyHandler } from './utils/cache';
import { createMemoryCacheProvider, createStrategy } from './utils/cache';
import { ClientError } from './error';
import type { RateLimitConfig, ThrottleManager } from './utils/rate-limit';
import { createThrottleManager } from './utils/rate-limit';
import { applyCvToQuery, extractCv } from './utils/cv';
import { createCacheKey, shouldUseCache } from './utils/request';
import { getRegionBaseUrl, type Region } from '@storyblok/region-helper';
import type { Block as Component } from '@storyblok/schema';
import type { RetryOptions } from 'ky';
import type { Client, RequestOptions } from './generated/shared/client';
import { createStoriesResource } from './resources/stories';
import { createLinksResource } from './resources/links';
import { createTagsResource } from './resources/tags';
import { createDatasourcesResource } from './resources/datasources';
import { createDatasourceEntriesResource } from './resources/datasource-entries';
import { createSpacesResource } from './resources/spaces';

// ---------------------------------------------------------------------------
// Client types (co-located with runtime)
// ---------------------------------------------------------------------------

export type ApiResponse<Data = unknown, ThrowOnError extends boolean = false> =
  ThrowOnError extends true
    ? { data: Data; error?: never; response: Response; request: Request }
    : { data?: Data; error?: ClientError; response: Response; request: Request };

export type HttpRequestOptions = Omit<
  RequestOptions,
  'method' | 'security' | 'url'
>;

export type HttpRequestMethod = <TData = unknown>(
  path: string,
  options?: HttpRequestOptions,
) => Promise<ApiResponse<TData>>;

/**
 * Arbitrary options forwarded to the underlying `fetch()` call.
 *
 * Standard `RequestInit` properties (`cache`, `credentials`, `mode`, …) and
 * non-standard, vendor-specific properties (Next.js `next`, Cloudflare `cf`, …)
 * are both supported.
 *
 * @example
 * ```ts
 * client.stories.get('home', {
 *   fetchOptions: {
 *     cache: 'no-store',
 *     next: { revalidate: 60, tags: ['home'] },
 *   },
 * })
 * ```
 */
export type FetchOptions = Record<string, unknown>;

export interface RequestWithCacheOptions {
  /** Prefix added to the cache key to namespace entries (e.g. `'inline'`). */
  cacheKeyPrefix?: string;
}

export interface ResourceDeps<DefaultThrowOnError extends boolean = false> {
  client: Client;
  requestWithCache: <TData, ThrowOnError extends boolean = DefaultThrowOnError>(
    method: 'GET',
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData, ThrowOnError>>,
    options?: RequestWithCacheOptions,
  ) => Promise<ApiResponse<TData, ThrowOnError>>;
  asApiResponse: <TData, ThrowOnError extends boolean = DefaultThrowOnError>(p: Promise<unknown>) => Promise<ApiResponse<TData, ThrowOnError>>;
  throttleManager: ThrottleManager;
}

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/**
 * Cache configuration.
 *
 * **Note:** Requests with `version: 'draft'` always bypass the cache regardless
 * of the configured strategy. Only published content is cached.
 */
export interface CacheConfig {
  /** Custom cache provider. Defaults to an in-memory LRU cache (1 000 entries). */
  provider?: CacheProvider;
  /** Cache strategy for published requests. @default 'cache-first' */
  strategy?: CacheStrategy | CacheStrategyHandler;
  /** Time-to-live in milliseconds for cached entries. @default 60_000 */
  ttlMs?: number;
  /**
   * Controls when the cache is flushed on cv change.
   *
   * - `'auto'` (default): automatically flush the cache whenever the API returns a new cv value.
   * - `'manual'`: never auto-flush; call `client.flushCache()` explicitly (e.g. on webhook trigger).
   */
  flush?: 'auto' | 'manual';
  /**
   * Called when SWR background revalidation fails.
   * Only relevant when `strategy` is `'swr'`.
   * @default console.warn
   */
  onRevalidationError?: (error: unknown) => void;
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
   * - `{ maxConcurrency?: number; adaptToServerHeaders?: boolean }`: full config.
   * - `false`: disable rate limiting entirely.
   */
  rateLimit?: RateLimitConfig | number | false;
  /**
   * Custom `fetch` function to use for all requests.
   * Must be fully compatible with the Fetch API standard.
   *
   * Use cases:
   * - SSR framework fetch wrappers (e.g., Next.js `fetch` with caching)
   * - Custom instrumentation or logging around requests
   *
   * @default globalThis.fetch
   */
  fetch?: typeof globalThis.fetch;
}

interface StoryblokTypesConfig {
  components: Component;
}

/**
 * The return type of `createApiClient`, parameterised by `TComponents` and `InlineRelations`
 * so that `.withTypes<T>()` can change the story response types without touching the
 * runtime object.
 */
export type ContentApiClient<
  TComponents extends Component = Component,
  InlineRelations extends boolean = false,
  ThrowOnError extends boolean = false,
> = Omit<ReturnType<typeof createApiClientBase>, 'stories' | 'withTypes'> & {
  stories: ReturnType<typeof createStoriesResource<TComponents, InlineRelations, ThrowOnError>>;
  /**
   * Returns the same client instance cast to a version that narrows story content
   * to the provided component types. No runtime cost — the type parameter is erased.
   *
   * @example
   * ```ts
   * import type { pageBlock, heroBlock } from './blocks';
   *
   * type StoryblokTypes = { components: typeof pageBlock | typeof heroBlock };
   *
   * const client = createApiClient({ accessToken: 'your-token' })
   *   .withTypes<StoryblokTypes>();
   * // story.content is now typed as a discriminated union
   * ```
   */
  withTypes: <T extends StoryblokTypesConfig>() => ContentApiClient<T['components'], InlineRelations, ThrowOnError>;
};

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export const createApiClientBase = <
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
    fetch: customFetch,
  } = config;
  const retryOptions: RetryOptions = { limit: 3, backoffLimit: 20_000, jitter: true, ...retry };
  // `rateLimit` defaults to `{}` (auto-detect mode) when not supplied.
  const throttleManager = createThrottleManager(rateLimit ?? {});
  const cacheProvider = cache.provider ?? createMemoryCacheProvider();
  const swrOptions = cache.onRevalidationError ? { onRevalidationError: cache.onRevalidationError } : undefined;
  const strategy = cache.strategy
    ? typeof cache.strategy === 'string'
      ? createStrategy(cache.strategy, swrOptions)
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
        ...(customFetch && { fetch: customFetch }),
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

  const updateCv = async (result: ApiResponse): Promise<boolean> => {
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

  const cacheSuccessResult = async <TResponse extends ApiResponse>(key: string, result: TResponse) => {
    const shouldCacheResult = await updateCv(result);
    if (result.error === undefined && shouldCacheResult) {
      await cacheProvider.set(key, {
        value: result,
        ttlMs: cacheTtlMs,
      });
    }
    return result;
  };

  const requestNetwork = async (
    method: 'GET',
    path: string,
    query: Record<string, unknown>,
    options: HttpRequestOptions,
  ): Promise<ApiResponse> => {
    return client.request<unknown, ClientError, boolean>({
      ...options,
      method,
      query,
      security,
      url: path,
    });
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
    cacheOptions?: RequestWithCacheOptions,
  ): Promise<ApiResponse<TData, ThrowOnError>> => {
    const query = currentCv !== undefined ? applyCvToQuery(rawQuery, currentCv) : rawQuery;
    const cacheEnabled = shouldUseCache(method, path, rawQuery);

    if (!cacheEnabled) {
      const networkResult = await fetchFn(query);
      throttleManager.adaptToResponse(networkResult.response);
      await updateCv(networkResult);
      return networkResult;
    }

    const baseKey = createCacheKey(method, path, rawQuery);
    const key = cacheOptions?.cacheKeyPrefix ? `${cacheOptions.cacheKeyPrefix}:${baseKey}` : baseKey;
    const cachedEntry = await cacheProvider.get<ApiResponse<TData, ThrowOnError>>(key);
    const cachedResult = cachedEntry?.value;

    const loadNetwork = async () => {
      const result = await fetchFn(query);
      throttleManager.adaptToResponse(result.response);
      return cacheSuccessResult(key, result);
    };

    return strategy({
      key,
      cachedResult,
      loadNetwork,
    });
  };

  const request = async (
    method: 'GET',
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse> => {
    const rawQuery = options.query || {};

    return requestWithCache(method, path, rawQuery, (query) => {
      return throttleManager.execute(path, rawQuery, () => requestNetwork(method, path, query, options));
    });
  };

  const getRequest = (
    path: string,
    options: HttpRequestOptions = {},
  ) => {
    return request('GET', path, options);
  };

  const resourceDeps: ResourceDeps<ThrowOnError> = {
    client,
    requestWithCache,
    asApiResponse,
    throttleManager,
  };

  const stories = createStoriesResource<Component, InlineRelations, ThrowOnError>({
    ...resourceDeps,
    inlineRelations,
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
    interceptors: client.interceptors,
    links: createLinksResource(resourceDeps),
    spaces: createSpacesResource(resourceDeps),
    stories,
    tags: createTagsResource(resourceDeps),
  };
};

/**
 * Creates a Storyblok Content Delivery API client.
 *
 * Use `.withTypes<YourTypes>()` on the returned client to enable discriminated
 * union typing on `story.content` without including any schema values in your bundle.
 *
 * @example
 * ```ts
 * import type { pageBlock, heroBlock } from './blocks';
 *
 * const client = createApiClient({ accessToken: 'your-token' })
 *   .withTypes<StoryblokTypes>();
 * ```
 */
export const createApiClient = <
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
>(
  config: ContentApiClientConfig<ThrowOnError, InlineRelations>,
): ContentApiClient<Component, InlineRelations, ThrowOnError> => {
  const base = createApiClientBase(config);
  const self: ContentApiClient<Component, InlineRelations, ThrowOnError> = {
    ...base,
    withTypes<T extends StoryblokTypesConfig>(): ContentApiClient<T['components'], InlineRelations, ThrowOnError> {
      return self as unknown as ContentApiClient<T['components'], InlineRelations, ThrowOnError>;
    },
  };
  return self;
};

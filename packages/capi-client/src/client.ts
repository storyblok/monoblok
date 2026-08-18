import { createClient, createConfig } from "./generated/capi/client";
import type { CacheProvider, CacheStrategy, CacheStrategyHandler } from "./utils/cache";
import { createMemoryCacheProvider, createStrategy } from "./utils/cache";
import { ClientError } from "./error";
import type { RateLimitConfig, ThrottleManager } from "./utils/rate-limit";
import { createThrottleManager } from "./utils/rate-limit";
import { applyCvToQuery, extractCv, extractSpaceVersion } from "./utils/cv";
import { querySerializer } from "./utils/query-serializer";
import { createCacheKey, isSpacesMeRequest, shouldUseCache } from "./utils/request";
import { getRegionBaseUrl, type Region } from "@storyblok/region-helper";
import type { Block as Component } from "./generated/types/block";
import type { RetryOptions } from "ky";
import type { Client, RequestOptions } from "./generated/capi/client";
import { createStoriesResource } from "./resources/stories";
import { createLinksResource } from "./resources/links";
import { createTagsResource } from "./resources/tags";
import { createDatasourcesResource } from "./resources/datasources";
import { createDatasourceEntriesResource } from "./resources/datasource-entries";
import { createSpacesResource } from "./resources/spaces";
import { createExperimentsResource } from "./resources/experiments";

// ---------------------------------------------------------------------------
// Client types (co-located with runtime)
// ---------------------------------------------------------------------------

export type ApiResponse<
  Data = unknown,
  ThrowOnError extends boolean = false,
> = ThrowOnError extends true
  ? { data: Data; error?: never; response: Response; request: Request }
  : { data?: Data; error?: ClientError; response: Response; request: Request };

export type HttpRequestOptions = Omit<RequestOptions, "method" | "security" | "url">;

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
    method: "GET",
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData, ThrowOnError>>,
    options?: RequestWithCacheOptions,
  ) => Promise<ApiResponse<TData, ThrowOnError>>;
  asApiResponse: <TData, ThrowOnError extends boolean = DefaultThrowOnError>(
    p: Promise<unknown>,
  ) => Promise<ApiResponse<TData, ThrowOnError>>;
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
   * Controls how the `cv` (content version) query parameter is managed.
   *
   * - `'auto'` (default): automatically attach the tracked `cv` to
   *   subsequent published requests for cache busting.
   * - `'manual'`: do not attach `cv` to outgoing requests. The client still
   *   tracks cv internally for cache invalidation (flushing when cv changes),
   *   but the query parameter is not sent. Useful for SSR with edge caching
   *   where stable URLs are required.
   */
  cv?: "auto" | "manual";
  /**
   * Controls when the cache is flushed on cv change.
   *
   * - `'auto'` (default): automatically flush the cache whenever the API returns a new cv value.
   * - `'manual'`: never auto-flush; call `client.flushCache()` explicitly (e.g. on webhook trigger).
   */
  flush?: "auto" | "manual";
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
   * - `number`: fixed requests per second (single queue).
   * - `{ requestsPerSecond?: number; adaptToServerHeaders?: boolean }`: full config.
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

type StoryblokTypesConfig = { components: Component } | { blocks: Component };

type ResolveComponents<T extends StoryblokTypesConfig> = T extends {
  components: infer C extends Component;
}
  ? C
  : T extends { blocks: infer B extends Component }
    ? B
    : never;

/** Extracts the `fieldType → value` plugin map from a Schema, defaulting to an empty map. */
type ResolveFieldPlugins<T> = T extends { fieldPlugins: infer P } ? P : Record<never, never>;

/**
 * The return type of `createApiClient`, parameterised by `TComponents` and `InlineRelations`
 * so that `.withTypes<T>()` can change the story response types without touching the
 * runtime object.
 */
export type ContentApiClient<
  TComponents extends Component = Component,
  TFieldPlugins = Record<never, never>,
  InlineRelations extends boolean = false,
  ThrowOnError extends boolean = false,
> = Omit<ReturnType<typeof createApiClientBase>, "stories" | "withTypes"> & {
  stories: ReturnType<
    typeof createStoriesResource<TComponents, TFieldPlugins, InlineRelations, ThrowOnError>
  >;
  /**
   * Returns the same client instance cast to a version that narrows story content
   * to the provided component types. No runtime cost — the type parameter is erased.
   *
   * Accepts either `{ components: ... }` or `{ blocks: ... }` — the latter matches the
   * `Schema` type produced by `@storyblok/schema`'s `InferSchema`.
   *
   * @example
   * ```ts
   * import type { Schema } from './schema';
   *
   * const client = createApiClient({ accessToken: 'your-token' })
   *   .withTypes<Schema>();
   * // story.content is now typed as a discriminated union
   * ```
   */
  withTypes: <T extends StoryblokTypesConfig>() => ContentApiClient<
    ResolveComponents<T>,
    ResolveFieldPlugins<T>,
    InlineRelations,
    ThrowOnError
  >;
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
    region = "eu",
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
  const swrOptions = cache.onRevalidationError
    ? { onRevalidationError: cache.onRevalidationError }
    : undefined;
  const strategy = cache.strategy
    ? typeof cache.strategy === "string"
      ? createStrategy(cache.strategy, swrOptions)
      : cache.strategy
    : createStrategy("cache-first");
  const cacheTtlMs = cache.ttlMs ?? 60_000;
  const cacheFlush = cache.flush ?? "auto";
  const cvMode = cache.cv ?? "auto";
  let currentCv: number | undefined;
  let currentSpaceVersion: number | undefined;
  /**
   * Set when a first `space.version` sighting was ambiguous, carrying the cv tracked at
   * that moment. The next cacheable request revalidates against the origin and the cv it
   * returns settles whether anything was actually published. See {@link updateSpaceVersion}.
   */
  let pendingRevalidation: { cvBefore: number } | undefined;

  const client: Client = createClient(
    createConfig({
      auth: accessToken,
      baseUrl: baseUrl || getRegionBaseUrl(region),
      headers,
      // Default serializer throws on nested objects; CAPI needs `filter_query`
      // serialized as a nested hash (`filter_query[field][op]=value`).
      querySerializer,
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
      new ClientError(response?.statusText || "API request failed", {
        status: response?.status ?? 0,
        statusText: response?.statusText ?? "",
        data: error,
      }),
  );

  const security = [
    {
      in: "query" as const,
      name: "token",
      type: "apiKey" as const,
    },
  ];

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

  /**
   * `/cdn/spaces/me` carries no `cv`, only the space's raw `version`. It is cached
   * for two seconds while the content endpoints are cached for a week, which makes
   * it the cheapest way to notice that content changed. Track it separately and use
   * it purely as a flush signal: the `cv` attached to requests keeps coming from
   * content responses, because the two values diverge for tokens with a Minimum
   * Cache TTL.
   *
   * `storyblok-js-client` implements the same heuristic in `cacheResponse`, with one
   * deliberate difference: it flushes on an ambiguous first sighting where this client
   * revalidates instead. Its tracked versions are module-level, so an ambiguous sighting
   * happens once per process rather than once per client, and there is no shared provider
   * for the flush to empty. Keep the rest of the rules in sync.
   *
   * Gated on the path as well as on the response shape: a `space.version` is only a
   * change signal when it comes from the endpoint that reports the space's raw version.
   * Any other response that happens to embed a numeric `space.version` must not flush.
   *
   * @param cvBefore the tracked cv as of before this response was processed.
   */
  const updateSpaceVersion = async (
    path: string,
    result: ApiResponse,
    cvBefore: number | undefined,
  ): Promise<void> => {
    if (!isSpacesMeRequest(path)) {
      return;
    }

    const nextSpaceVersion = extractSpaceVersion(result.data);
    if (nextSpaceVersion === undefined) {
      return;
    }

    const hasSpaceVersionChanged =
      currentSpaceVersion !== undefined && currentSpaceVersion !== nextSpaceVersion;

    if (cacheFlush === "auto" && hasSpaceVersionChanged) {
      // Reset the tracked cv along with the cache: the edge keeps serving the old
      // object for `?cv=<old>` for up to a week, so reusing it would refill the cache
      // with the very content that was just flushed. Dropping it makes the next
      // published request omit `cv` and take the origin's 301 to the current one.
      await flushCache();
    }

    // On the very first sighting there is no previous space version to compare against,
    // so compare against the cv instead. Without a Minimum Cache TTL — the default —
    // the API floors nothing and both values report the same raw version, so an equal
    // pair proves that nothing was published between the content request and this first
    // poll and there is nothing to do. An unequal pair means either a publish landed in
    // between or a TTL is flooring the cv, and neither can be told apart from here.
    //
    // Rather than flush on that ambiguity, defer it: drop the tracked cv so the next
    // cacheable request goes out without one and takes the origin's 301 to the current
    // cv, and let the cv that comes back decide. This keeps the cost of an ambiguous
    // sighting to one revalidation by this client, instead of a flush that also empties
    // a `cache.provider` shared with every other client.
    if (
      cacheFlush === "auto" &&
      currentSpaceVersion === undefined &&
      cvBefore !== undefined &&
      cvBefore !== nextSpaceVersion
    ) {
      pendingRevalidation = { cvBefore };
      currentCv = undefined;
    }

    currentSpaceVersion = nextSpaceVersion;
  };

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

    if (cacheFlush === "auto" && currentCv !== undefined && currentCv !== nextCv) {
      // Only the local cache is flushed here: the cv is replaced by `nextCv` right
      // below, so — unlike the space-version path — no stale cv is left behind.
      await cacheProvider.flush();
    }

    currentCv = nextCv;
    return true;
  };

  /**
   * Tracks both version signals carried by a response and flushes the cache when
   * either one reports that content changed.
   *
   * The space version is handled first so that a response carrying both signals (only
   * `/cdn/spaces/me` reports a space version today, and it carries no `cv`) still ends
   * up with the cv taken from that same response rather than dropped by the flush.
   *
   * @returns whether the result may be cached.
   */
  const trackResponseVersions = async (path: string, result: ApiResponse): Promise<boolean> => {
    const cvBefore = currentCv;
    await updateSpaceVersion(path, result, cvBefore);
    return updateCv(result);
  };

  const cacheSuccessResult = async <TResponse extends ApiResponse>(
    path: string,
    key: string,
    result: TResponse,
  ) => {
    const shouldCacheResult = await trackResponseVersions(path, result);
    if (result.error === undefined && shouldCacheResult) {
      await cacheProvider.set(key, {
        value: result,
        ttlMs: cacheTtlMs,
      });
    }
    return result;
  };

  const requestNetwork = async (
    method: "GET",
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
  ): Promise<ApiResponse<TData, ThrowOnError>> =>
    p as unknown as Promise<ApiResponse<TData, ThrowOnError>>;

  const requestWithCache = async <TData = unknown, ThrowOnError extends boolean = false>(
    method: "GET",
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData, ThrowOnError>>,
    cacheOptions?: RequestWithCacheOptions,
  ): Promise<ApiResponse<TData, ThrowOnError>> => {
    const cacheEnabled = shouldUseCache(method, path, rawQuery);
    // The `cv` is a cache buster, so it only belongs on requests that are cacheable in
    // the first place. `/cdn/spaces/me` carries no `cv` of its own and is only cached
    // for two seconds; attaching one there fragments the edge cache of the endpoint the
    // polling pattern depends on, for no gain.
    const query =
      cacheEnabled && cvMode === "auto" && currentCv !== undefined
        ? applyCvToQuery(rawQuery, currentCv)
        : rawQuery;

    if (!cacheEnabled) {
      const networkResult = await fetchFn(query);
      throttleManager.adaptToResponse(networkResult.response);
      await trackResponseVersions(path, networkResult);
      return networkResult;
    }

    const baseKey = createCacheKey(method, path, rawQuery);
    const key = cacheOptions?.cacheKeyPrefix
      ? `${cacheOptions.cacheKeyPrefix}:${baseKey}`
      : baseKey;
    const loadNetwork = async () => {
      const result = await fetchFn(query);
      throttleManager.adaptToResponse(result.response);
      return cacheSuccessResult(path, key, result);
    };

    // An ambiguous `space.version` sighting is settled here rather than by a flush: this
    // request bypasses the cache and, with the tracked cv already dropped, goes out
    // without a `cv`, so the origin redirects it to the current one. A cv that moved
    // means content really was published and the cache is emptied — before this fresh
    // response is stored. An unchanged cv means a Minimum Cache TTL was flooring it all
    // along and every cached entry is still valid.
    if (pendingRevalidation !== undefined) {
      const { cvBefore } = pendingRevalidation;
      pendingRevalidation = undefined;

      const result = await fetchFn(query);
      throttleManager.adaptToResponse(result.response);

      const nextCv = extractCv(result.data);
      if (cacheFlush === "auto" && nextCv !== undefined && nextCv !== cvBefore) {
        await cacheProvider.flush();
      }

      return cacheSuccessResult(path, key, result);
    }

    const cachedEntry = await cacheProvider.get<ApiResponse<TData, ThrowOnError>>(key);
    const cachedResult = cachedEntry?.value;

    return strategy({
      key,
      cachedResult,
      loadNetwork,
    });
  };

  const request = async (
    method: "GET",
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse> => {
    const rawQuery = options.query || {};

    return requestWithCache(method, path, rawQuery, (query) => {
      return throttleManager.execute(path, rawQuery, () =>
        requestNetwork(method, path, query, options),
      );
    });
  };

  const getRequest = (path: string, options: HttpRequestOptions = {}) => {
    return request("GET", path, options);
  };

  const resourceDeps: ResourceDeps<ThrowOnError> = {
    client,
    requestWithCache,
    asApiResponse,
    throttleManager,
  };

  const stories = createStoriesResource<
    Component,
    Record<never, never>,
    InlineRelations,
    ThrowOnError
  >({
    ...resourceDeps,
    inlineRelations,
  });

  return {
    datasourceEntries: createDatasourceEntriesResource(resourceDeps),
    datasources: createDatasourcesResource(resourceDeps),
    experiments: createExperimentsResource(resourceDeps),
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
): ContentApiClient<Component, Record<never, never>, InlineRelations, ThrowOnError> => {
  const base = createApiClientBase(config);
  const self: ContentApiClient<Component, Record<never, never>, InlineRelations, ThrowOnError> = {
    ...base,
    withTypes<T extends StoryblokTypesConfig>(): ContentApiClient<
      ResolveComponents<T>,
      ResolveFieldPlugins<T>,
      InlineRelations,
      ThrowOnError
    > {
      return self as unknown as ContentApiClient<
        ResolveComponents<T>,
        ResolveFieldPlugins<T>,
        InlineRelations,
        ThrowOnError
      >;
    },
  };
  return self;
};

import { createClient, createConfig } from "./generated/capi/client";
import type { CacheProvider, CacheStrategy, CacheStrategyHandler } from "./utils/cache";
import {
  createMemoryCacheProvider,
  createNetworkFirstStrategy,
  createStrategy,
} from "./utils/cache";
import { ClientError } from "./error";
import type { RateLimitConfig, ThrottleManager } from "./utils/rate-limit";
import { createThrottleManager } from "./utils/rate-limit";
import { applyCvToQuery, extractCv, extractSpaceVersion, stripCvFromQuery } from "./utils/cv";
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

/** See {@link createApiClientBase}'s `pendingRevalidation`. */
type PendingRevalidation = { cvBefore: number; inFlight?: Promise<void> };

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
  // Settles an ambiguous `space.version` sighting — see `requestWithCache`.
  const revalidationStrategy = createNetworkFirstStrategy();
  const cacheTtlMs = cache.ttlMs ?? 60_000;
  const cacheFlush = cache.flush ?? "auto";
  const cvMode = cache.cv ?? "auto";
  let currentCv: number | undefined;
  let currentSpaceVersion: number | undefined;
  /**
   * An ambiguous first `space.version` sighting, with the cv tracked at that moment. The
   * next cacheable request revalidates and the cv it returns settles it. `inFlight` is
   * set while that request is out, so concurrent requests wait for it instead of each
   * settling the same sighting. See {@link updateSpaceVersion}.
   */
  let pendingRevalidation: PendingRevalidation | undefined;
  /**
   * Bumped on every flush. A response that was already in flight when the cache was
   * emptied belongs to the previous epoch: it may carry the very cv that was just
   * dropped, so it must neither be cached nor restore the tracked cv.
   */
  let cacheEpoch = 0;

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
    cacheEpoch++;
    // A signal still pending here is answered by this flush; leaving it armed would force
    // the next request onto network-first and flush a shared provider a second time.
    pendingRevalidation = undefined;
  };

  /**
   * Tracks `space.version` from `/cdn/spaces/me` and flushes when it moves.
   *
   * That endpoint is cached for two seconds where content is cached for a week, which
   * makes it the cheapest way to notice a publish. It reports no `cv`, and its
   * `space.version` is not one: a Minimum Cache TTL floors the `cv` into TTL-sized
   * buckets while `space.version` keeps reporting the raw version. Change signal only —
   * the `cv` sent with requests still comes from content responses.
   *
   * Gated on the path, not just the response shape: another response that embeds a
   * numeric `space.version` must not flush.
   *
   * Both tracked versions live on the client instance, so polling only works from a
   * client that outlives a request. A per-request client starts with both `undefined`,
   * and a read served from a shared `cache.provider` never tracks a `cv` — so neither
   * branch below can fire, and staleness is bounded by `cache.ttlMs` alone.
   *
   * `storyblok-js-client` implements the same heuristic in `cacheResponse`; keep the
   * flush rules in sync.
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
      // Also drops the tracked cv: the edge serves `?cv=<old>` for up to a week, so
      // keeping it would refill the cache with the content just flushed. Without a cv the
      // next request takes the origin's 301 to the current one.
      await flushCache();
    }

    // A first sighting has no previous space version to compare against, so compare
    // against the cv. Without a Minimum Cache TTL both report the same raw version, so an
    // equal pair proves nothing was published. An unequal pair is either a publish or a
    // TTL flooring the cv, and the two cannot be told apart here.
    //
    // So defer instead of flushing: drop the tracked cv and let the next cacheable
    // request revalidate without one and settle it. That costs one request by this client
    // — concurrent ones wait for it, see `requestWithCache` — rather than a flush that
    // also empties a shared `cache.provider`.
    if (
      cacheFlush === "auto" &&
      currentSpaceVersion === undefined &&
      cvBefore !== undefined &&
      cvBefore !== nextSpaceVersion
    ) {
      if (cvMode === "auto") {
        // The tracked cv is kept, not dropped: the settling request strips the cv from
        // its own query, so it still reaches the origin's current version, while
        // `updateCv` keeps a baseline to reject a stale edge node answering with a lower
        // cv. Dropping it here would disarm that guard for exactly that response.
        pendingRevalidation = { cvBefore };
      } else {
        // Under `cv: 'manual'` requests never carry a cv, so a revalidation would be
        // byte-identical to the request before it and a warm edge object would answer it
        // with the same cv — settling the sighting falsely. Flush defensively instead,
        // like `storyblok-js-client`; it is bounded to once per client instance.
        await flushCache();
      }
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
      // Only the cache is flushed: `nextCv` replaces the cv right below, so unlike the
      // space-version path no stale cv is left behind. The epoch still has to move: the
      // cache key carries no cv, so a response already in flight would refill the entry
      // this just dropped. `flushCache` is not reused here — it would clear the cv this
      // function is about to set, and answer a pending sighting this cv cannot settle.
      await cacheProvider.flush();
      cacheEpoch++;
    }

    currentCv = nextCv;
    return true;
  };

  /**
   * Tracks both version signals a response carries and flushes when either reports a
   * change. The space version goes first, so a response carrying both keeps the cv from
   * that same response instead of having it dropped by the flush.
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
    epochAtRequest: number,
  ) => {
    // Stale by construction: the cache was emptied while this was in flight.
    if (epochAtRequest !== cacheEpoch) {
      return result;
    }
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

    // Exactly one request settles a sighting, claimed before the first `await` so the
    // check and the mark cannot interleave. The rest wait: settling can flush and it
    // recovers the tracked cv, so the cv and the cached entry read below are the ones it
    // is about to replace. Waiting costs the batch one round trip, or as long as the
    // settle's retries and timeout when the origin is unwell — a waiter still never takes
    // over a settle that failed, or one dead request becomes a chain of them. Only
    // cacheable requests take part: a poll must not block behind the request it
    // triggered.
    let revalidation: PendingRevalidation | undefined;
    let settled: (() => void) | undefined;
    let waitForSettle: Promise<void> | undefined;
    if (cacheEnabled && pendingRevalidation !== undefined) {
      if (pendingRevalidation.inFlight === undefined) {
        revalidation = pendingRevalidation;
        revalidation.inFlight = new Promise<void>((resolve) => {
          settled = resolve;
        });
      } else {
        waitForSettle = pendingRevalidation.inFlight;
      }
    }

    try {
      if (waitForSettle !== undefined) {
        await waitForSettle;
      }

      // The cv is a cache buster, so it only belongs on cacheable requests. On
      // `/cdn/spaces/me` it would only fragment the edge cache of the endpoint polling
      // depends on.
      // A settle must reach the origin's current version, so it carries no cv at all --
      // not the tracked one (a request in flight when the sighting was armed can have
      // restored it) and not a caller-supplied one.
      const query =
        revalidation !== undefined
          ? stripCvFromQuery(rawQuery)
          : cacheEnabled && cvMode === "auto" && currentCv !== undefined
            ? applyCvToQuery(rawQuery, currentCv)
            : rawQuery;

      if (!cacheEnabled) {
        const epochAtRequest = cacheEpoch;
        const networkResult = await fetchFn(query);
        throttleManager.adaptToResponse(networkResult.response);
        if (epochAtRequest === cacheEpoch) {
          await trackResponseVersions(path, networkResult);
        } else {
          // Still let `/cdn/spaces/me` record its version: it carries no cv, so it cannot
          // resurrect a flushed one, and dropping it would re-arm the same sighting.
          await updateSpaceVersion(path, networkResult, currentCv);
        }
        return networkResult;
      }

      const baseKey = createCacheKey(method, path, rawQuery);
      const key = cacheOptions?.cacheKeyPrefix
        ? `${cacheOptions.cacheKeyPrefix}:${baseKey}`
        : baseKey;
      const cachedEntry = await cacheProvider.get<ApiResponse<TData, ThrowOnError>>(key);
      const cachedResult = cachedEntry?.value;

      const loadNetwork = async () => {
        // Re-synced after a flush this request performs itself: the epoch guard is meant
        // to drop responses invalidated by *someone else*, not the fresh one that just
        // emptied the cache and is about to refill it.
        let epochAtRequest = cacheEpoch;
        const result = await fetchFn(query);
        throttleManager.adaptToResponse(result.response);

        // `currentSpaceVersion` has already advanced, so the claimed record is all that
        // can still settle the ambiguity.
        if (revalidation !== undefined) {
          if (result.error !== undefined) {
            // The signal stays pending for a later request to retry. Serving the cached
            // entry keeps that retry invisible: settling must never turn a cache hit into
            // an error.
            if (cachedResult !== undefined) {
              return cachedResult;
            }
          } else {
            // A cv that moved means content was published, so the cache is emptied before
            // the fresh response is stored. An unchanged cv means a Minimum Cache TTL was
            // flooring it and every cached entry is still valid.
            const nextCv = extractCv(result.data);
            if (nextCv === undefined) {
              // The settle landed on an endpoint that reports no cv (`/cdn/tags`,
              // `/cdn/links`), so the sighting cannot be disambiguated from the response.
              // Flush defensively rather than consume the signal unchecked: bounded to
              // once per client instance, and matching `storyblok-js-client`.
              if (cacheFlush === "auto") {
                await flushCache();
                epochAtRequest = cacheEpoch;
              }
            } else {
              // Only a cv that moved FORWARD means content was published. A lower cv is a
              // stale edge node answering; flushing on it would empty the cache and drag
              // the tracked cv backwards.
              if (cacheFlush === "auto" && nextCv > revalidation.cvBefore) {
                await flushCache();
                epochAtRequest = cacheEpoch;
              }
            }

            // Consumed only once the flush it implies has run, so a provider that throws
            // leaves the signal pending rather than dropping it.
            pendingRevalidation = undefined;
          }
        }

        return cacheSuccessResult(path, key, result, epochAtRequest);
      };

      if (revalidation === undefined) {
        return await strategy({ key, cachedResult, loadNetwork });
      }

      // A revalidation has to reach the network, so it skips the configured strategy's
      // cache-hit shortcut and uses network-first semantics instead: try the origin, fall
      // back to the cached entry. With the tracked cv dropped it carries no `cv`, so the
      // origin redirects it to the current one. Blocking under `swr` is intended —
      // whether the stale entry is still valid is exactly what is being settled.
      return await revalidationStrategy({ key, cachedResult, loadNetwork });
    } finally {
      // Released only once any flush has run, so the waiters read the cache the settle
      // left behind. The mark goes either way: a signal still pending here is one whose
      // settle failed, and dropping the mark is what lets a later request retry it.
      if (revalidation !== undefined) {
        revalidation.inFlight = undefined;
        settled?.();
      }
    }
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

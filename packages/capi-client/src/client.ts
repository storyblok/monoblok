import { createClient, createConfig } from "./generated/capi/client";
import type { CacheProvider, CacheStrategy, CacheStrategyHandler } from "./utils/cache";
import { createMemoryCacheProvider, createStrategy } from "./utils/cache";
import { ClientError } from "./error";
import type { RateLimitConfig, ThrottleManager } from "./utils/rate-limit";
import { createThrottleManager } from "./utils/rate-limit";
import { applyCvToQuery, extractCv, extractSpaceVersion } from "./utils/cv";
import { querySerializer } from "./utils/query-serializer";
import { createCacheKey, isSpacesMeRequest, shouldUseCache } from "./utils/request";
import { createTokenId } from "./utils/token-id";
import {
  haveVersionsChanged,
  mergeVersions,
  readVersions,
  versionsKey,
  writeVersions,
} from "./utils/versions";
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
  /**
   * Custom cache provider. Defaults to an in-memory LRU cache (1 000 entries).
   *
   * Sharing one provider between clients is supported and is what makes the publish
   * signal work for per-request clients: entry keys are scoped to a hash of the access
   * token, so clients for different spaces cannot read each other's content.
   *
   * The client keeps its version watermarks in the provider under the reserved key
   * `sb:versions:v1:<tokenId>`, so clients and processes sharing a provider share them.
   * Do not store anything else under that key: dropping it costs one refetch per entry.
   */
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
   *   tracks the cv for cache invalidation, but the query parameter is not sent.
   *   Useful for SSR with edge caching where stable URLs are required.
   */
  cv?: "auto" | "manual";
  /**
   * Controls whether the client invalidates cached entries on its own when it notices a
   * new content version.
   *
   * - `'auto'` (default): entries stop being served as soon as the API reports a version
   *   newer than the one they were served under. The provider is not emptied — entries
   *   that are no longer served expire by TTL or eviction.
   * - `'manual'`: a version change never invalidates a cached entry; call
   *   `client.flushCache()` explicitly (e.g. on webhook trigger). Versions are still
   *   tracked, and a response answered for a version that has since been superseded is
   *   still not cached in either mode: that keeps known-stale content out of the cache
   *   rather than invalidating what is already in it.
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
  /**
   * Where the version watermarks live. In the provider, not on this closure, so that
   * every client sharing the provider — including a fresh one per request — shares them.
   */
  /** Identifies the space in cache keys without putting the token itself in them. */
  const tokenId = createTokenId(accessToken);
  const watermarksKey = versionsKey(tokenId);

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
   * Empty the cache and reset the tracked versions.
   *
   * Call this explicitly when `cache.flush` is set to `'manual'`, e.g. after
   * receiving a Storyblok webhook event that signals content has changed.
   */
  const flushCache = async (): Promise<void> => {
    await cacheProvider.flush();
    // The watermarks describe entries that no longer exist. Recording an empty record
    // rather than relying on `flush()` having removed it also invalidates anything a
    // partial provider implementation left behind.
    await writeVersions(cacheProvider, watermarksKey, {});
  };

  /**
   * Records the versions a response reports, applies the publish signal, and decides
   * whether the response may be cached.
   *
   * Two signals arrive: the `cv` in a content response body identifies the published
   * snapshot that response belongs to, and `space.version` from `/cdn/spaces/me` reports
   * the space's raw version. That endpoint is cached for two seconds where content is
   * cached for a week, which makes polling it the cheapest way to notice a publish.
   *
   * The two are not interchangeable — a Minimum Cache TTL floors the `cv` into TTL-sized
   * buckets while `space.version` keeps reporting the raw version — so each only ever
   * advances its own watermark, and a publish is recognised by `space.version` moving
   * forward against itself.
   *
   * Noticing a publish drops `knownCv`, which makes every entry tagged with the old `cv`
   * unreachable and sends the next request out without a `cv` so the origin redirects it
   * to the current one. The provider is not flushed: unreachable entries expire on their
   * own, and flushing would also empty a provider shared with clients that keep their own
   * entries in it.
   *
   * The space version is gated on the path, not just the response shape: another response
   * that happens to embed a numeric `space.version` must not invalidate anything.
   *
   * @param learnCv whether this response's `cv` may advance the watermark. Draft
   * responses bypass the cache and a caller-pinned `cv` describes the caller's choice
   * rather than the space's current state, so neither may teach one.
   * @param knownCvAtIssue the `cv` this request was issued under. A response is discarded
   * when that `cv` is no longer the known one: it was answered for a version that has
   * since been superseded, so caching it would refill the cache with pre-publish content
   * and teach back the `cv` the publish dropped.
   */
  const applyResponseVersions = async (
    path: string,
    result: ApiResponse,
    { learnCv, knownCvAtIssue }: { learnCv: boolean; knownCvAtIssue?: number },
  ): Promise<{ mayCache: boolean; cv?: number }> => {
    const bodyCv = extractCv(result.data);
    const spaceVersion = isSpacesMeRequest(path) ? extractSpaceVersion(result.data) : undefined;
    const current = await readVersions(cacheProvider, watermarksKey);

    const isSuperseded = knownCvAtIssue !== undefined && current?.knownCv !== knownCvAtIssue;
    // A response reporting a `cv` below the known one came from an edge node still holding
    // an older snapshot. Stale by construction, so it must neither teach a `cv` nor be
    // stored over the newer entry that may already be there.
    const isStaleEdgeRead =
      bodyCv !== undefined && current?.knownCv !== undefined && bodyCv < current.knownCv;
    const mayCache = !isSuperseded && !isStaleEdgeRead;

    let next = mergeVersions(current, {
      knownCv: learnCv && mayCache ? bodyCv : undefined,
      knownSpaceVersion: spaceVersion,
    });

    if (spaceVersion !== undefined && cacheFlush === "auto") {
      const lastSpaceVersion = current?.knownSpaceVersion;
      // Only a version that moved FORWARD is a publish. A lower one is a stale read from
      // a POP whose two-second cache has not caught up.
      const isPublish = lastSpaceVersion !== undefined && spaceVersion > lastSpaceVersion;
      // A first sighting has no previous space version to compare against, so compare
      // against the known `cv`. Without a Minimum Cache TTL both report the same raw
      // version, so a version ahead of the `cv` means content was published between the
      // first content response and this poll. With one, the `cv` lags by design and this
      // costs a single needless revalidation per watermark record.
      const isAheadOfKnownCv =
        lastSpaceVersion === undefined && next.knownCv !== undefined && spaceVersion > next.knownCv;

      if (isPublish || isAheadOfKnownCv) {
        next = { ...next, knownCv: undefined };
      }
    }

    if (haveVersionsChanged(current, next)) {
      await writeVersions(cacheProvider, watermarksKey, next);
    }

    return { mayCache, cv: bodyCv };
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

    if (!cacheEnabled) {
      // No cv is attached: it is a cache buster, and on `/cdn/spaces/me` it would only
      // fragment the edge cache of the endpoint polling depends on. Draft requests ignore
      // it altogether.
      const networkResult = await fetchFn(rawQuery);
      throttleManager.adaptToResponse(networkResult.response);
      await applyResponseVersions(path, networkResult, { learnCv: false });

      return networkResult;
    }

    const baseKey = createCacheKey(method, path, rawQuery, tokenId);
    const key = cacheOptions?.cacheKeyPrefix
      ? `${cacheOptions.cacheKeyPrefix}:${baseKey}`
      : baseKey;

    const [cachedEntry, versions] = await Promise.all([
      cacheProvider.get<ApiResponse<TData, ThrowOnError>>(key),
      readVersions(cacheProvider, watermarksKey),
    ]);

    // A caller asking for one specific snapshot gets that snapshot: its entry lives under
    // its own key, is immune to publishes, expires by TTL alone, and never teaches a `cv`.
    const isCvPinnedByCaller = rawQuery.cv !== undefined;
    // A missing watermark record counts as "cv unknown", so a tagged entry is stale: the
    // record shares the provider with the entries it governs and can be evicted while
    // they survive, and reading a tagged entry against no known version at all would
    // silently fall back to TTL-only invalidation. One refetch rewrites the record.
    const isStaleByCv =
      cacheFlush === "auto" &&
      !isCvPinnedByCaller &&
      cachedEntry?.cv !== undefined &&
      cachedEntry.cv !== versions?.knownCv;
    const cachedResult = isStaleByCv ? undefined : cachedEntry?.value;

    // With a known cv the request is pinned to that snapshot; without one it goes out bare
    // and the origin redirects it to the current version, at the cost of one extra hop.
    const query =
      cvMode === "auto" && versions?.knownCv !== undefined
        ? applyCvToQuery(rawQuery, versions.knownCv)
        : rawQuery;

    const loadNetwork = async () => {
      const result = await fetchFn(query);
      throttleManager.adaptToResponse(result.response);

      const knownCvAtIssue = isCvPinnedByCaller ? undefined : versions?.knownCv;
      const { mayCache, cv } = await applyResponseVersions(path, result, {
        learnCv: !isCvPinnedByCaller,
        knownCvAtIssue,
      });

      if (result.error === undefined && mayCache) {
        // Tagged with the `cv` it was served under, so it stops being readable the moment
        // a newer one is known — including for entries stored by another client or
        // process sharing the provider. Endpoints that report no `cv` of their own
        // (`/cdn/tags`, `/cdn/links`) are tagged with the `cv` they were requested under,
        // which is the version they were answered for; only a request issued while no
        // `cv` was known stays untagged and falls back to TTL alone.
        await cacheProvider.set(key, {
          value: result,
          ttlMs: cacheTtlMs,
          cv: cv ?? knownCvAtIssue,
        });
      }

      return result;
    };

    return strategy({ key, cachedResult, loadNetwork });
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

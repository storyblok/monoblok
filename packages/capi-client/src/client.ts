import { createClient, createConfig } from "./generated/capi/client";
import type {
  CacheProvider,
  CacheStrategy,
  CacheStrategyHandler,
  StrategyFailure,
} from "./utils/cache";
import {
  createMemoryCacheProvider,
  createNetworkFirstStrategy,
  createStrategy,
  isTransientStatus,
} from "./utils/cache";
import { ClientError } from "./error";
import type { RateLimitConfig, ThrottleManager } from "./utils/rate-limit";
import { createThrottleManager } from "./utils/rate-limit";
import {
  applyCvToQuery,
  extractCurrentCv,
  extractCv,
  extractServedCv,
  extractSpaceVersion,
  isCvPinned,
} from "./utils/cv";
import { claimCvCheck, cvCheckedKey, readCvClock, recordCvChecked } from "./utils/cv-refresh";
import { querySerializer } from "./utils/query-serializer";
import {
  createCacheKey,
  isCvCheckRequest,
  isDraftRequest,
  isSpacesMeRequest,
  shouldUseCache,
} from "./utils/request";
import { createTokenId } from "./utils/token-id";
import {
  haveVersionsChanged,
  mergeVersions,
  readVersions,
  type VersionWatermarks,
  versionsKey,
  writeVersions,
} from "./utils/versions";
import { getRegionBaseUrl, type Region } from "@storyblok/region-helper";
import type { Block as Component } from "./generated/types/block";
import type { RetryOptions } from "ky";
import type { Client, RequestOptions, ResolvedRequestOptions } from "./generated/capi/client";
import { createStoriesResource } from "./resources/stories";
import { createLinksResource } from "./resources/links";
import { createTagsResource } from "./resources/tags";
import { createDatasourcesResource } from "./resources/datasources";
import { createDatasourceEntriesResource } from "./resources/datasource-entries";
import { createSpacesResource } from "./resources/spaces";
import { createExperimentsResource } from "./resources/experiments";
import { createStrataResource } from "./resources/strata";

// ---------------------------------------------------------------------------
// Client types (co-located with runtime)
// ---------------------------------------------------------------------------

export type ApiResponse<
  Data = unknown,
  ThrowOnError extends boolean = false,
> = ThrowOnError extends true
  ? { data: Data; error?: never; response: Response; request: Request }
  : { data?: Data; error?: ClientError; response: Response; request: Request };

// `responseStyle: "data"` would unwrap the body at runtime, which `ApiResponse` can't describe.
export type HttpRequestOptions = Omit<
  RequestOptions,
  "method" | "security" | "url" | "responseStyle"
>;

/**
 * `client.get()`. Overloads instead of a second type parameter: TS can't infer one type argument
 * while another is passed explicitly, so `get<T>(path, { throwOnError: false })` would fail.
 */
type ApiClientGet<ThrowOnError extends boolean> = {
  <TData = unknown>(
    path: string,
    options: HttpRequestOptions & { throwOnError: true },
  ): Promise<ApiResponse<TData, true>>;
  <TData = unknown>(
    path: string,
    options: HttpRequestOptions & { throwOnError: false },
  ): Promise<ApiResponse<TData, false>>;
  <TData = unknown>(
    path: string,
    options?: HttpRequestOptions & { throwOnError?: undefined },
  ): Promise<ApiResponse<TData, ThrowOnError>>;
  <TData = unknown>(
    path: string,
    options?: HttpRequestOptions,
  ): Promise<ApiResponse<TData, boolean>>;
};

/** Past this, a slow discovering read costs more than the redirects it saves. */
const MAX_CV_DISCOVERY_WAIT_MS = 2000;

const waitForCvDiscovery = async (discovery: Promise<void>): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, MAX_CV_DISCOVERY_WAIT_MS);
  });
  await Promise.race([discovery, timeout]);
  clearTimeout(timer);
};

/**
 * Describes the failure a response represents, or `undefined` if it succeeded. The cache
 * strategies cannot inspect an `ApiResponse` themselves, and with `throwOnError` disabled
 * an HTTP error resolves rather than rejects — so without this they would only ever see a
 * transport-level failure.
 */
const getFailure = (result: ApiResponse): StrategyFailure | undefined =>
  result.error === undefined
    ? undefined
    : {
        // The generated client resolves transport failures with no response. There
        // was no origin answer to classify, so network-first must treat this as
        // transient and use its cached value.
        transient:
          (result.response?.status ?? 0) === 0 || isTransientStatus(result.response?.status ?? 0),
        error: result.error,
      };

/**
 * Describes the failure a rejection represents. A `ClientError` is an HTTP answer the
 * origin gave — the shape an error takes with `throwOnError` enabled — and is classified
 * by its status like any other. Anything else got no answer at all: a timeout, a DNS
 * failure, an aborted socket. Those are transient by nature.
 */
const getThrownFailure = (error: unknown): StrategyFailure => ({
  transient: error instanceof ClientError ? isTransientStatus(error.response.status) : true,
  error,
});

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
  /** `'manual'` keeps follow-up requests free of a `cv` and pagination walks from pinning one. */
  cvMode?: CacheConfig["cv"];
  /**
   * The served `cv` stored with the cache entry a result was read from, for a provider that
   * serializes entries and so loses the `Response` URL it is otherwise read from.
   */
  readCachedServedCv?: (result: ApiResponse<unknown, boolean>) => number | undefined;
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
   * Custom cache provider. Defaults to an in-memory LRU cache (1,000 entries).
   *
   * Clients may share a provider, which lets per-request clients share the publish signal.
   * Keys are scoped per access token. The keys `sb:versions:v1:<tokenId>` and
   * `sb:cv-checked:v1:<tokenId>` are reserved for the version watermarks and the `cv` check.
   */
  provider?: CacheProvider;
  /**
   * Cache strategy for published requests. A custom handler that answers from `cachedResult`
   * whenever it has one never sends the `cv` check (see `cv`), so it shows a publish only
   * once the entry's TTL expires.
   *
   * @default 'cache-first'
   */
  strategy?: CacheStrategy | CacheStrategyHandler;
  /** Time-to-live in milliseconds for cached entries. @default 60_000 */
  ttlMs?: number;
  /**
   * Controls how the `cv` (content version) query parameter is managed.
   *
   * - `'auto'` (default): attach the tracked `cv` to published requests, so the CDN
   *   serves them from its cache. The CDN keeps serving a `cv` it holds after a publish,
   *   so under `flush: 'auto'`, at most once a minute, a published read of stories or links
   *   goes out without it to learn the current one, even when the response is cached. Under
   *   `'cache-first'` and `'network-first'`, when that read fails transiently (a network
   *   error, a 5xx, 408, 413 or 429) once its retries are exhausted, the cached response is
   *   returned; any other error is returned as usual. Under `'swr'` it is the background
   *   revalidation; a custom strategy handler decides whether that read uses the network.
   * - `'manual'`: do not attach `cv` to outgoing requests. The client still
   *   tracks the cv for cache invalidation, but the query parameter is not sent.
   *   Useful for SSR with edge caching where stable URLs are required.
   */
  cv?: "auto" | "manual";
  /**
   * Controls whether the client invalidates cached entries when it notices a new content
   * version.
   *
   * - `'auto'` (default): entries stop being served once the API reports a newer version
   *   than the one they were served under. The provider isn't emptied; stale entries
   *   expire by TTL or eviction.
   * - `'manual'`: a version change never invalidates a cached entry, and the client never
   *   checks the known `cv` (see `cv`); call `client.flushCache()` explicitly, for example
   *   from a webhook. A newer `cv` the client learns, e.g. from a draft read, still applies to
   *   requests that miss the cache, while cached entries serve the old snapshot until then.
   *
   * In either mode, a response that was in flight across a publish or a `flushCache()` is
   * not cached. One issued before any `cv` was known is caught only by a moved space
   * version, and a `flushCache()` racing a response's provider write can be undone by it,
   * so call it when no requests are pending if that matters.
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
  InlineLinks extends boolean = false,
> {
  accessToken: string;
  region?: Region;
  baseUrl?: string;
  headers?: Record<string, string>;
  throwOnError?: ThrowOnError;
  cache?: CacheConfig;
  /**
   * Inlines the related stories a request resolves with `resolve_relations` in place of their
   * UUIDs, up to two levels deep.
   * @default false
   */
  inlineRelations?: InlineRelations;
  /**
   * Sets `story` on each story link (a multilink field or a rich text link mark) to its entry
   * in the response's `links`, when a request passes `resolve_links`. Also inlines the links
   * of related stories (with `resolve_links_in_relations: 1`) and of linked stories (with
   * `resolve_links_level: 2`). Links beyond the API's resolve limit are fetched. The entry's
   * shape depends on the `resolve_links` value (see `InlinedLink`).
   * @default false
   */
  inlineLinks?: InlineLinks;
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
   * - `false`: disable rate limiting entirely.
   * - `RateLimitConfig`: see that type for the individual options.
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
   * Keep `response.url`: the client learns the current `cv` from the URL the API redirected a
   * request to. A rebuilt `Response` (e.g. `new Response(r.body, r)`) drops it; then only
   * story responses teach a `cv`, from their body, and an app that reads no stories caches with
   * TTL-only invalidation, which the once-a-minute `cv` check doesn't change. Interceptors and
   * framework caches that rebuild the `Response` do the same, e.g. Next.js `cacheComponents`
   * prerender caches return `url: ""`.
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

/** Names the inferred shape so declaration output reuses the same story resource type. */
type ApiClientBaseResult<
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
  InlineLinks extends boolean = false,
> = {
  datasourceEntries: ReturnType<typeof createDatasourceEntriesResource<ThrowOnError>>;
  datasources: ReturnType<typeof createDatasourcesResource<ThrowOnError>>;
  experiments: ReturnType<typeof createExperimentsResource<ThrowOnError>>;
  flushCache: () => Promise<void>;
  get: ApiClientGet<ThrowOnError>;
  interceptors: Client["interceptors"];
  links: ReturnType<typeof createLinksResource<ThrowOnError>>;
  spaces: ReturnType<typeof createSpacesResource<ThrowOnError>>;
  stories: ReturnType<
    typeof createStoriesResource<
      Component,
      Record<never, never>,
      InlineRelations,
      ThrowOnError,
      InlineLinks
    >
  >;
  strata: ReturnType<typeof createStrataResource<ThrowOnError>>;
  tags: ReturnType<typeof createTagsResource<ThrowOnError>>;
};

/**
 * The return type of `createApiClient`. Its type parameters let `.withTypes<T>()` change the
 * story response types without touching the runtime object.
 */
export type ContentApiClient<
  TComponents extends Component = Component,
  TFieldPlugins = Record<never, never>,
  InlineRelations extends boolean = false,
  ThrowOnError extends boolean = false,
  InlineLinks extends boolean = false,
> = Omit<
  ApiClientBaseResult<ThrowOnError, InlineRelations, InlineLinks>,
  "stories" | "withTypes"
> & {
  stories: ReturnType<
    typeof createStoriesResource<
      TComponents,
      TFieldPlugins,
      InlineRelations,
      ThrowOnError,
      InlineLinks
    >
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
    ThrowOnError,
    InlineLinks
  >;
};

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

let hasWarnedAboutCircularRelations = false;

/**
 * TypeScript only rejects the removed 0.x `circularRelations` option in an object literal,
 * and JavaScript not at all, so it would otherwise be ignored without a trace.
 * @todo(next-major): Remove this warning.
 */
const warnAboutRemovedCircularRelations = (config: object) => {
  if (hasWarnedAboutCircularRelations || !("circularRelations" in config)) {
    return;
  }
  hasWarnedAboutCircularRelations = true;
  console.warn(
    "[storyblok/api-client] The `circularRelations` option was removed in 1.0.0 and is ignored. " +
      "Inlined relations go up to two levels deep and are never circular; relations below stay " +
      "UUID strings. Look them up in the response's `rels`, or fetch them by UUID if the response " +
      "lists them in `rel_uuids`.",
  );
};

export const createApiClientBase = <
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
  InlineLinks extends boolean = false,
>(
  config: ContentApiClientConfig<ThrowOnError, InlineRelations, InlineLinks>,
): ApiClientBaseResult<ThrowOnError, InlineRelations, InlineLinks> => {
  warnAboutRemovedCircularRelations(config);
  const {
    accessToken,
    region = "eu",
    baseUrl,
    headers = {},
    throwOnError = false,
    cache = {},
    inlineRelations = false,
    inlineLinks = false,
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
  // A check of the `cv` must reach the origin, yet a failing one should not cost a read the
  // cache could have answered, so `cache-first` checks network-first. `swr` already revalidates
  // in the background, so it checks there, and a custom handler decides for itself.
  const cvCheckStrategy =
    cache.strategy === undefined || cache.strategy === "cache-first"
      ? createNetworkFirstStrategy()
      : strategy;
  const cacheTtlMs = cache.ttlMs ?? 60_000;
  const cacheFlush = cache.flush ?? "auto";
  const cvMode = cache.cv ?? "auto";
  const tokenId = createTokenId(accessToken);
  const watermarksKey = versionsKey(tokenId);
  const checkKey = cvCheckedKey(tokenId);

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
        // Admission waits here, before ky starts the timeout clock: a queue
        // longer than `timeout` must delay requests, not fail them.
        hooks: { beforeRequest: [throttleManager.beforeRequest] },
        retry: retryOptions,
        // `globalThis.fetch` is read per call so a fetch swapped in after the
        // client was created still applies.
        fetch: throttleManager.wrapFetch(
          customFetch ?? ((input, init) => globalThis.fetch(input, init)),
        ),
      },
    }),
  );

  // The final URL of an error response, which a `ClientError` doesn't carry, for the `cv` it
  // was redirected to.
  const errorResponseUrls = new WeakMap<ClientError, string>();

  client.interceptors.error.use(
    (
      error: unknown,
      response: Response | undefined,
      _request: Request | undefined,
      options: ResolvedRequestOptions,
    ) => {
      if (!response) {
        // A transport failure only ever reaches the interceptor through the generated
        // client's outer catch, which — unlike the HTTP-error path below — passes the
        // options as given to this call, not merged with the client-level default. A
        // call that relies on that default rather than overriding `throwOnError` itself
        // would otherwise read as `undefined` here regardless of the effective value.
        if (options.throwOnError ?? throwOnError) {
          // No HTTP answer at all — a timeout, an abort, a DNS failure. This rejects as-is
          // rather than being wrapped, so its name, message, and `instanceof` checks (e.g.
          // `AbortError`) survive.
          return error;
        }

        // Without `throwOnError` this resolves as `result.error`, which `ApiResponse`
        // types as `ClientError`. Wrap it here to keep that contract accurate — unlike the
        // rejection path, callers can't narrow a resolved value by `instanceof` before
        // touching it, so it has to already be the declared shape. The original error
        // stays reachable via `cause`.
        return new ClientError("API request failed", {
          status: 0,
          statusText: "",
          data: undefined,
          cause: error,
        });
      }

      const clientError = new ClientError(response.statusText || "API request failed", {
        status: response.status,
        statusText: response.statusText,
        data: error,
      });
      errorResponseUrls.set(clientError, response.url);
      return clientError;
    },
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
   * Call this explicitly when `cache.flush` is set to `'manual'`, for example after
   * receiving a Storyblok webhook event that signals content has changed.
   */
  const flushCache = async (): Promise<void> => {
    const current = await readVersions(cacheProvider, watermarksKey).catch(() => undefined);
    await cacheProvider.flush();
    // Keep facts about the space, not about entries: the stale-read floor, the space
    // version baseline for the next poll, and a bumped generation to discard in-flight
    // responses.
    await writeVersions(cacheProvider, watermarksKey, {
      highestCv: current?.highestCv,
      knownSpaceVersion: current?.knownSpaceVersion,
      generation: (current?.generation ?? 0) + 1,
    });
  };

  /**
   * Records the versions a response reports, applies the publish signal, and decides
   * whether the response may be cached. See ADR-0018.
   *
   * A publish drops `knownCv` instead of flushing, since the provider may be shared with
   * other clients.
   *
   * The record is read, merged, and written back without a lock (`CacheProvider` has no
   * compare-and-swap), so concurrent requests can overwrite a poll's invalidation. That
   * costs one repeated invalidation on the next poll, never serving an entry past its
   * version.
   *
   * @param servedCv the `cv` of the snapshot served, which exposes a stale edge read.
   * @param currentCv a `cv` the response proves current, which may advance the watermark.
   * @param honorOlderSnapshot keep a response reporting a `cv` below the known one, which
   * only a caller-pinned snapshot may.
   * @param issuedUnder the versions the request was issued under; omitted for a pinned
   * snapshot, which no publish supersedes.
   * @param generationAtIssue the flush generation at issue, a missing record counting as 0.
   */
  const applyResponseVersions = async (
    path: string,
    data: unknown,
    {
      servedCv,
      currentCv,
      honorOlderSnapshot = false,
      issuedUnder,
      generationAtIssue,
    }: {
      servedCv: number | undefined;
      currentCv: number | undefined;
      honorOlderSnapshot?: boolean;
      issuedUnder?: { knownCv?: number; knownSpaceVersion?: number };
      generationAtIssue: number;
    },
  ): Promise<{ mayCache: boolean; isStaleEdgeRead: boolean }> => {
    const spaceVersion = isSpacesMeRequest(path) ? extractSpaceVersion(data) : undefined;
    const current = await readVersions(cacheProvider, watermarksKey);

    // A superseded response served from the new `cv` only lost a race; keep it.
    const carriesKnownCv = servedCv !== undefined && servedCv === current?.knownCv;
    const wasFlushedInFlight = (current?.generation ?? 0) !== generationAtIssue;
    // Without a `cv` at issue, a moved space version is the publish that superseded it.
    const wasPublishedInFlight =
      issuedUnder !== undefined &&
      (issuedUnder.knownCv !== undefined
        ? current?.knownCv !== issuedUnder.knownCv
        : issuedUnder.knownSpaceVersion !== undefined &&
          current?.knownSpaceVersion !== issuedUnder.knownSpaceVersion);
    const isSuperseded = wasFlushedInFlight || (wasPublishedInFlight && !carriesKnownCv);
    // An edge node still holding an older snapshot looks identical on the wire to a pinned
    // request, so only the caller's intent separates them. Compared against `highestCv`
    // because an invalidation resets `knownCv`.
    const isStaleEdgeRead =
      !honorOlderSnapshot &&
      servedCv !== undefined &&
      current?.highestCv !== undefined &&
      servedCv < current.highestCv;
    const mayCache = !isSuperseded && !isStaleEdgeRead;

    let next = mergeVersions(current, {
      knownCv: mayCache ? currentCv : undefined,
      knownSpaceVersion: spaceVersion,
    });

    if (spaceVersion !== undefined && cacheFlush === "auto") {
      const lastSpaceVersion = current?.knownSpaceVersion;
      // A lower version is a stale read from an edge location's two-second cache.
      const isPublish = lastSpaceVersion !== undefined && spaceVersion > lastSpaceVersion;
      // A first sighting has no space version to compare against, so compare against the
      // `cv`. Under a Minimum Cache TTL the `cv` lags, costing one needless revalidation.
      const isAheadOfKnownCv =
        lastSpaceVersion === undefined && next.knownCv !== undefined && spaceVersion > next.knownCv;

      if (isPublish || isAheadOfKnownCv) {
        next = { ...next, knownCv: undefined };
      }
    }

    if (haveVersionsChanged(current, next)) {
      // Don't write away a `flushCache()` that landed since the read; this narrows the race
      // to the write itself.
      const latest = await readVersions(cacheProvider, watermarksKey);
      if ((latest?.generation ?? 0) !== (current?.generation ?? 0)) {
        return { mayCache: false, isStaleEdgeRead };
      }

      await writeVersions(cacheProvider, watermarksKey, next);
      // The known `cv` only moves to a current one, so learning one restarts the refresh window.
      if (next.knownCv !== undefined && next.knownCv !== current?.knownCv) {
        await recordCvChecked(cacheProvider, checkKey, readCvClock());
      }
    }

    return { mayCache, isStaleEdgeRead };
  };

  /**
   * Builds a placeholder `Request` for a call that never got far enough to produce one
   * — a malformed `baseUrl` fails here too, in which case a request pointing nowhere in
   * particular still beats losing `result.error`, which carries the original, more
   * useful message (including the full attempted request URL).
   */
  const createFallbackRequest = (): Request => {
    try {
      return new Request(baseUrl || getRegionBaseUrl(region));
    } catch {
      return new Request("about:blank");
    }
  };

  /**
   * Wraps a raw SDK call to cast the `error: unknown` type returned by
   * generated code to `ClientError` — the error interceptor ensures the
   * runtime value IS a ClientError. Also keeps the public response contract
   * stable when Hey API represents a transport failure without Response/Request
   * objects, so every resource call (not just `client.request()`) sees a
   * synthetic `Response`/`Request` rather than `undefined`.
   */
  const asApiResponse = <TData, ThrowOnError extends boolean = false>(
    p: Promise<unknown>,
  ): Promise<ApiResponse<TData, ThrowOnError>> =>
    p.then((result) => {
      const typedResult = result as ApiResponse<TData, ThrowOnError>;
      return {
        ...typedResult,
        response: typedResult.response ?? Response.error(),
        request: typedResult.request ?? createFallbackRequest(),
      };
    });

  const requestNetwork = (
    method: "GET",
    path: string,
    query: Record<string, unknown>,
    options: HttpRequestOptions,
  ): Promise<ApiResponse<unknown, boolean>> =>
    asApiResponse<unknown, boolean>(
      client.request<unknown, ClientError, boolean>({
        ...options,
        // An explicit `undefined` would override the client-level setting.
        throwOnError: options.throwOnError ?? throwOnError,
        method,
        // The generated client writes the token into the query object it is given.
        query: { ...query },
        security,
        url: path,
      }),
    );

  let cvDiscovery: Promise<void> | undefined;

  /**
   * The origin redirects a published read without a `cv` to the current one, and the limiter
   * admits the redirect and the followed request as one. So while no `cv` is known, a single
   * read goes out to learn it and concurrent ones wait for it, then go out pinned.
   */
  const awaitCvDiscovery = async (
    versions: VersionWatermarks | undefined,
  ): Promise<{ versions: VersionWatermarks | undefined; endDiscovery?: () => void }> => {
    if (cvMode !== "auto" || versions?.knownCv !== undefined) {
      return { versions };
    }
    if (cvDiscovery) {
      await waitForCvDiscovery(cvDiscovery);
      // Still unknown after a failed, slow or cv-less discovery: go out unpinned rather than
      // queue again.
      const latest = await readVersions(cacheProvider, watermarksKey).catch(() => versions);
      return { versions: latest };
    }
    let release = () => {};
    const discovery = new Promise<void>((resolve) => {
      release = resolve;
    });
    cvDiscovery = discovery;
    const endDiscovery = () => {
      if (cvDiscovery === discovery) {
        cvDiscovery = undefined;
      }
      release();
    };
    return { versions, endDiscovery };
  };

  const cachedServedCvs = new WeakMap<ApiResponse<unknown, boolean>, number>();

  const requestWithCache = async <TData = unknown, ThrowOnError extends boolean = false>(
    method: "GET",
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData, ThrowOnError>>,
    cacheOptions?: RequestWithCacheOptions,
  ): Promise<ApiResponse<TData, ThrowOnError>> => {
    const cacheEnabled = shouldUseCache(method, path, rawQuery);

    if (!cacheEnabled) {
      // No `cv` is attached: on `/cdn/spaces/me` it would fragment the edge cache polling
      // depends on, and drafts ignore it. A draft's `cv` is still a publish signal, the
      // only one for apps that never poll `/cdn/spaces/me`. Drafts come from the origin, so
      // their `cv` is current; other uncached responses teach none.
      const versionsAtIssue = readVersions(cacheProvider, watermarksKey);
      // Awaited after the request; prevents an unhandled rejection meanwhile.
      versionsAtIssue.catch(() => undefined);
      const networkResult = await fetchFn(rawQuery);

      try {
        const versions = await versionsAtIssue;
        await applyResponseVersions(path, networkResult.data, {
          servedCv: extractServedCv(networkResult, { method, path, query: rawQuery }),
          currentCv: isDraftRequest(rawQuery) ? extractCv(networkResult.data) : undefined,
          issuedUnder: {
            knownCv: versions?.knownCv,
            knownSpaceVersion: versions?.knownSpaceVersion,
          },
          generationAtIssue: versions?.generation ?? 0,
        });
      } catch {
        // A failing provider costs the publish signal, not the response.
      }

      return networkResult;
    }

    const keyFor = (query: Record<string, unknown>) => {
      const baseKey = createCacheKey(method, path, query, tokenId);
      return cacheOptions?.cacheKeyPrefix ? `${cacheOptions.cacheKeyPrefix}:${baseKey}` : baseKey;
    };
    const callerCv = isCvPinned(rawQuery.cv) ? Number(rawQuery.cv) : undefined;
    // A non-version `cv` would only cost a redirect; the known one is sent anyway.
    const unpinnedQuery =
      rawQuery.cv === undefined
        ? rawQuery
        : Object.fromEntries(Object.entries(rawQuery).filter(([name]) => name !== "cv"));
    const unpinnedKey = keyFor(unpinnedQuery);
    const pinnedKey = callerCv === undefined ? undefined : keyFor(rawQuery);

    // A pinned request reads the unpinned entry only to share it, which needs an automatic
    // `cv`. The read keeps that entry recently used in an LRU provider even when it isn't
    // shared, so it is skipped otherwise. A failed read only forgoes sharing.
    const readUnpinnedEntry = () =>
      cacheProvider.get<ApiResponse<TData, ThrowOnError>>(unpinnedKey);
    const [unpinnedEntry, pinnedEntry, versions] = await Promise.all([
      pinnedKey === undefined
        ? readUnpinnedEntry()
        : cvMode === "auto"
          ? readUnpinnedEntry().catch(() => undefined)
          : undefined,
      pinnedKey === undefined
        ? undefined
        : cacheProvider.get<ApiResponse<TData, ThrowOnError>>(pinnedKey),
      readVersions(cacheProvider, watermarksKey),
    ]);
    // Pinning the `cv` an unpinned request would send asks for the same snapshot, so it
    // shares the unpinned entry while that entry holds this snapshot.
    const sharesUnpinnedEntry =
      cvMode === "auto" &&
      callerCv !== undefined &&
      callerCv === versions?.knownCv &&
      unpinnedEntry?.cv === callerCv;
    // A pinned request lives under its own key.
    const isPinnedRequest = pinnedKey !== undefined && !sharesUnpinnedEntry;
    const key = isPinnedRequest ? pinnedKey : unpinnedKey;
    const cacheableQuery = isPinnedRequest ? rawQuery : unpinnedQuery;
    const cachedEntry = isPinnedRequest ? pinnedEntry : unpinnedEntry;
    // The pinned snapshot is immune to publishes and expires by TTL. A pin redirected to the
    // current cv holds that one, which a publish supersedes like any other.
    const holdsPinnedSnapshot = isPinnedRequest && cachedEntry?.cv === callerCv;
    // A missing record (e.g. evicted) makes tagged entries stale rather than TTL-only.
    const isStaleByCv =
      cacheFlush === "auto" &&
      !holdsPinnedSnapshot &&
      cachedEntry?.cv !== undefined &&
      cachedEntry.cv !== versions?.knownCv;
    const cachedResult = isStaleByCv ? undefined : cachedEntry?.value;
    if (cachedResult !== undefined && cachedEntry?.servedCv !== undefined) {
      cachedServedCvs.set(cachedResult, cachedEntry.servedCv);
    }
    // Under `flush: 'manual'` only `flushCache()` changes what a cached key serves, so a check
    // would cost a request per minute for nothing. A caller's own `cv` is sent as given, even
    // when it matches the known one.
    const mayCheckCv =
      cvMode === "auto" &&
      cacheFlush === "auto" &&
      callerCv === undefined &&
      versions?.knownCv !== undefined &&
      isCvCheckRequest(path);
    const cvCheck = mayCheckCv
      ? await claimCvCheck(cacheProvider, checkKey, readCvClock())
      : undefined;
    const isCvCheck = cvCheck !== undefined;

    let hasLoadedNetwork = false;
    const loadNetwork = async () => {
      hasLoadedNetwork = true;
      const discovery = isPinnedRequest ? { versions } : await awaitCvDiscovery(versions);
      try {
        return await loadNetworkUnder(discovery.versions);
      } finally {
        discovery.endDiscovery?.();
      }
    };

    const loadNetworkUnder = async (versions: VersionWatermarks | undefined) => {
      // Without a known `cv`, or to check it, the origin redirects the bare request to the
      // current one.
      const query =
        cvMode === "auto" && versions?.knownCv !== undefined && !isCvCheck
          ? applyCvToQuery(cacheableQuery, versions.knownCv)
          : cacheableQuery;

      // An error response was redirected like any other, so its URL holds the served `cv` too.
      const applyServedVersions = (result: {
        data?: unknown;
        response?: Pick<Response, "url">;
      }) => {
        // A pinned `cv` the edge doesn't hold (e.g. `cv: Date.now()`) is redirected to the
        // current one, so only a response reporting the pinned `cv` or none is that snapshot.
        const servedCv = extractServedCv(result, { method, path, query });
        const isPinnedSnapshot =
          isPinnedRequest && (servedCv === undefined || servedCv === callerCv);
        const issuedUnder = isPinnedSnapshot
          ? undefined
          : { knownCv: versions?.knownCv, knownSpaceVersion: versions?.knownSpaceVersion };
        const currentCv = isPinnedSnapshot
          ? undefined
          : extractCurrentCv(result, { method, path, query });
        return applyResponseVersions(path, result.data, {
          servedCv,
          currentCv,
          honorOlderSnapshot: isPinnedSnapshot,
          issuedUnder,
          generationAtIssue: versions?.generation ?? 0,
        }).then((versions) => ({
          ...versions,
          servedCv,
          currentCv,
          issuedUnder,
          isPinnedSnapshot,
        }));
      };

      let result: ApiResponse<TData, ThrowOnError>;
      try {
        result = await fetchFn(query);
      } catch (error) {
        const url = error instanceof ClientError ? errorResponseUrls.get(error) : undefined;
        if (url !== undefined) {
          // A rejection under `throwOnError` still teaches the versions of its response.
          await applyServedVersions({ response: { url } }).catch(() => undefined);
        }
        throw error;
      } finally {
        // Recorded once the check is answered, whatever it learned, so a failing one costs one
        // attempt per window.
        if (cvCheck) {
          await recordCvChecked(cacheProvider, checkKey, cvCheck.claimedAt);
        }
      }

      const { mayCache, isStaleEdgeRead, servedCv, currentCv, issuedUnder, isPinnedSnapshot } =
        await applyServedVersions(result);

      // A check answered by an edge node still holding an older snapshot would flip content
      // back until the next check.
      if (isCvCheck && isStaleEdgeRead && cachedResult !== undefined) {
        return cachedResult;
      }
      // A check sent no `cv`, so without a learned one nothing describes its response.
      const cv = isPinnedSnapshot
        ? servedCv
        : (currentCv ?? (isCvCheck ? undefined : issuedUnder?.knownCv));
      const isUndescribedCheck = isCvCheck && cv === undefined;
      if (result.error === undefined && mayCache && !isUndescribedCheck) {
        // Untagged (no `cv` sent, none learned), the entry expires by TTL alone.
        await cacheProvider.set(key, { value: result, ttlMs: cacheTtlMs, cv, servedCv });
      }

      return result;
    };

    try {
      return await (isCvCheck ? cvCheckStrategy : strategy)({
        key,
        cachedResult,
        loadNetwork,
        getFailure,
        getThrownFailure,
      });
    } finally {
      // An `swr` revalidation of this key in flight, or a custom handler answering from the
      // cache, sends no check; the next read claims it instead.
      if (!hasLoadedNetwork) {
        cvCheck?.release();
      }
    }
  };

  const request = async (
    method: "GET",
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<unknown, boolean>> => {
    const rawQuery = options.query || {};

    return requestWithCache(method, path, rawQuery, (query) => {
      return throttleManager.execute(path, rawQuery, () =>
        requestNetwork(method, path, query, options),
      );
    });
  };

  function getRequest<TData = unknown>(
    path: string,
    options: HttpRequestOptions & { throwOnError: true },
  ): Promise<ApiResponse<TData, true>>;
  function getRequest<TData = unknown>(
    path: string,
    options: HttpRequestOptions & { throwOnError: false },
  ): Promise<ApiResponse<TData, false>>;
  function getRequest<TData = unknown>(
    path: string,
    options?: HttpRequestOptions & { throwOnError?: undefined },
  ): Promise<ApiResponse<TData, ThrowOnError>>;
  function getRequest<TData = unknown>(
    path: string,
    options?: HttpRequestOptions,
  ): Promise<ApiResponse<TData, boolean>>;
  function getRequest(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<unknown, boolean>> {
    return request("GET", path, options);
  }

  const resourceDeps: ResourceDeps<ThrowOnError> = {
    client,
    requestWithCache,
    asApiResponse,
    throttleManager,
    cvMode,
    readCachedServedCv: (result) => cachedServedCvs.get(result),
  };

  // Keep the declaration output aligned with ContentApiClient["stories"].
  const stories: ReturnType<
    typeof createStoriesResource<
      Component,
      Record<never, never>,
      InlineRelations,
      ThrowOnError,
      InlineLinks
    >
  > = createStoriesResource<
    Component,
    Record<never, never>,
    InlineRelations,
    ThrowOnError,
    InlineLinks
  >({
    ...resourceDeps,
    inlineRelations,
    inlineLinks,
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
    strata: createStrataResource(resourceDeps),
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
  InlineLinks extends boolean = false,
>(
  config: ContentApiClientConfig<ThrowOnError, InlineRelations, InlineLinks>,
): ContentApiClient<
  Component,
  Record<never, never>,
  InlineRelations,
  ThrowOnError,
  InlineLinks
> => {
  const base = createApiClientBase(config);
  const self: ContentApiClient<
    Component,
    Record<never, never>,
    InlineRelations,
    ThrowOnError,
    InlineLinks
  > = {
    ...base,
    withTypes<T extends StoryblokTypesConfig>(): ContentApiClient<
      ResolveComponents<T>,
      ResolveFieldPlugins<T>,
      InlineRelations,
      ThrowOnError,
      InlineLinks
    > {
      return self as unknown as ContentApiClient<
        ResolveComponents<T>,
        ResolveFieldPlugins<T>,
        InlineRelations,
        ThrowOnError,
        InlineLinks
      >;
    },
  };
  return self;
};

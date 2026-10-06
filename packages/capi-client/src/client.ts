import { createClient, createConfig } from "./generated/capi/client";
import type {
  CacheProvider,
  CacheStrategy,
  CacheStrategyHandler,
  StrategyFailure,
} from "./utils/cache";
import { createMemoryCacheProvider, createStrategy, isTransientStatus } from "./utils/cache";
import { ClientError } from "./error";
import type { RateLimitConfig, ThrottleManager } from "./utils/rate-limit";
import { createThrottleManager } from "./utils/rate-limit";
import { applyCvToQuery, extractServedCv, extractSpaceVersion, isCvPinned } from "./utils/cv";
import { querySerializer } from "./utils/query-serializer";
import { createCacheKey, isSpacesMeRequest, shouldUseCache } from "./utils/request";
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
  /** The client's `cache.cv` mode. `'manual'` stops pagination walks from pinning a `cv`. */
  cvMode?: CacheConfig["cv"];
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
   * Keys are scoped per access token. The key `sb:versions:v1:<tokenId>` is reserved for
   * the version watermarks.
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
   * Controls whether the client invalidates cached entries when it notices a new content
   * version.
   *
   * - `'auto'` (default): entries stop being served once the API reports a newer version
   *   than the one they were served under. The provider isn't emptied; stale entries
   *   expire by TTL or eviction.
   * - `'manual'`: a version change never invalidates a cached entry; call
   *   `client.flushCache()` explicitly, for example from a webhook.
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
> = {
  datasourceEntries: ReturnType<typeof createDatasourceEntriesResource<ThrowOnError>>;
  datasources: ReturnType<typeof createDatasourcesResource<ThrowOnError>>;
  experiments: ReturnType<typeof createExperimentsResource<ThrowOnError>>;
  flushCache: () => Promise<void>;
  get: (path: string, options?: HttpRequestOptions) => Promise<ApiResponse>;
  interceptors: Client["interceptors"];
  links: ReturnType<typeof createLinksResource<ThrowOnError>>;
  spaces: ReturnType<typeof createSpacesResource<ThrowOnError>>;
  stories: ReturnType<
    typeof createStoriesResource<Component, Record<never, never>, InlineRelations, ThrowOnError>
  >;
  tags: ReturnType<typeof createTagsResource<ThrowOnError>>;
};

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
> = Omit<ApiClientBaseResult<ThrowOnError, InlineRelations>, "stories" | "withTypes"> & {
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
): ApiClientBaseResult<ThrowOnError, InlineRelations> => {
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

      return new ClientError(response.statusText || "API request failed", {
        status: response.status,
        statusText: response.statusText,
        data: error,
      });
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
   * @param learnCv whether this response's `cv` may advance the watermark.
   * @param honorOlderSnapshot keep a response reporting a `cv` below the known one, which
   * only a caller-pinned snapshot may.
   * @param issuedUnder the versions the request was issued under; omitted for a pinned
   * snapshot, which no publish supersedes.
   * @param generationAtIssue the flush generation at issue, a missing record counting as 0.
   */
  const applyResponseVersions = async (
    path: string,
    result: ApiResponse,
    {
      learnCv,
      honorOlderSnapshot = false,
      issuedUnder,
      generationAtIssue,
    }: {
      learnCv: boolean;
      honorOlderSnapshot?: boolean;
      issuedUnder?: { knownCv?: number; knownSpaceVersion?: number };
      generationAtIssue: number;
    },
  ): Promise<{ mayCache: boolean; cv?: number }> => {
    const bodyCv = extractServedCv(result);
    const spaceVersion = isSpacesMeRequest(path) ? extractSpaceVersion(result.data) : undefined;
    const current = await readVersions(cacheProvider, watermarksKey);

    // A superseded response whose body reports the new `cv` only lost a race; keep it.
    const carriesKnownCv = bodyCv !== undefined && bodyCv === current?.knownCv;
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
      bodyCv !== undefined &&
      current?.highestCv !== undefined &&
      bodyCv < current.highestCv;
    const mayCache = !isSuperseded && !isStaleEdgeRead;

    let next = mergeVersions(current, {
      knownCv: learnCv && mayCache ? bodyCv : undefined,
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
        return { mayCache: false };
      }

      await writeVersions(cacheProvider, watermarksKey, next);
    }

    return { mayCache, cv: bodyCv };
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
  ): Promise<ApiResponse> =>
    asApiResponse(
      client.request<unknown, ClientError, boolean>({
        ...options,
        method,
        query,
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
      // only one for apps that never poll `/cdn/spaces/me`.
      const versionsAtIssue = readVersions(cacheProvider, watermarksKey);
      // Awaited after the request; prevents an unhandled rejection meanwhile.
      versionsAtIssue.catch(() => undefined);
      const networkResult = await fetchFn(rawQuery);

      try {
        const versions = await versionsAtIssue;
        await applyResponseVersions(path, networkResult, {
          learnCv: true,
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

    // A pinned snapshot lives under its own key, is immune to publishes, and expires by TTL.
    const isCvPinnedByCaller = isCvPinned(rawQuery.cv);
    // A non-version `cv` would only cost a redirect and a duplicate cache entry.
    const cacheableQuery =
      isCvPinnedByCaller || rawQuery.cv === undefined
        ? rawQuery
        : Object.fromEntries(Object.entries(rawQuery).filter(([name]) => name !== "cv"));

    const baseKey = createCacheKey(method, path, cacheableQuery, tokenId);
    const key = cacheOptions?.cacheKeyPrefix
      ? `${cacheOptions.cacheKeyPrefix}:${baseKey}`
      : baseKey;

    const [cachedEntry, versions] = await Promise.all([
      cacheProvider.get<ApiResponse<TData, ThrowOnError>>(key),
      readVersions(cacheProvider, watermarksKey),
    ]);
    // A missing record (e.g. evicted) makes tagged entries stale rather than TTL-only.
    const isStaleByCv =
      cacheFlush === "auto" &&
      !isCvPinnedByCaller &&
      cachedEntry?.cv !== undefined &&
      cachedEntry.cv !== versions?.knownCv;
    const cachedResult = isStaleByCv ? undefined : cachedEntry?.value;

    const loadNetwork = async () => {
      const discovery = isCvPinnedByCaller ? { versions } : await awaitCvDiscovery(versions);
      try {
        return await loadNetworkUnder(discovery.versions);
      } finally {
        discovery.endDiscovery?.();
      }
    };

    const loadNetworkUnder = async (versions: VersionWatermarks | undefined) => {
      // Without a known `cv`, the origin redirects the bare request to the current one.
      const query =
        cvMode === "auto" && versions?.knownCv !== undefined
          ? applyCvToQuery(cacheableQuery, versions.knownCv)
          : cacheableQuery;

      const result = await fetchFn(query);

      // A pinned `cv` the edge doesn't hold (e.g. `cv: Date.now()`) is redirected to the
      // current one, so only a response reporting the pinned `cv` or none is that snapshot.
      const bodyCv = extractServedCv(result);
      const isPinnedSnapshot =
        isCvPinnedByCaller && (bodyCv === undefined || bodyCv === Number(rawQuery.cv));
      const issuedUnder = isPinnedSnapshot
        ? undefined
        : { knownCv: versions?.knownCv, knownSpaceVersion: versions?.knownSpaceVersion };
      const { mayCache, cv } = await applyResponseVersions(path, result, {
        learnCv: !isPinnedSnapshot,
        honorOlderSnapshot: isPinnedSnapshot,
        issuedUnder,
        generationAtIssue: versions?.generation ?? 0,
      });

      if (result.error === undefined && mayCache) {
        // Endpoints reporting no `cv` (`/cdn/tags`, `/cdn/links`) are tagged with the one
        // they were requested under.
        await cacheProvider.set(key, {
          value: result,
          ttlMs: cacheTtlMs,
          cv: cv ?? issuedUnder?.knownCv,
        });
      }

      return result;
    };

    return strategy({
      key,
      cachedResult,
      loadNetwork,
      getFailure,
      getThrownFailure,
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
    cvMode,
  };

  // Keep the declaration output aligned with ContentApiClient["stories"].
  const stories: ReturnType<
    typeof createStoriesResource<Component, Record<never, never>, InlineRelations, ThrowOnError>
  > = createStoriesResource<Component, Record<never, never>, InlineRelations, ThrowOnError>({
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

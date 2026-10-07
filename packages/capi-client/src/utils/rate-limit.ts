/**
 * Rate limiting for the Content API client.
 *
 * Provides a tier-aware manager that selects the right per-second limit based
 * on request type (single story vs. listing) and the per_page query parameter,
 * mirroring the per-second tiers the Storyblok CDN enforces.
 */
import type {
  AdaptiveConfig,
  RateLimitContext,
  RateLimitContextResolver,
  RateLimiter,
  RateLimitStatus,
  RequestAdmission,
} from "@storyblok/utils/rate-limiting";
import {
  CACHE_STATUS_HEADER,
  createDefaultRateLimiter,
  createPassthroughRateLimiter,
  createRequestAdmission,
  createThrottle,
  determineRateLimitTier,
  MAX_RATE_LIMIT,
  parseCacheStatus,
  parseRateLimitPolicy,
  RATE_LIMIT_POLICY_HEADER,
  RATE_LIMIT_TIERS,
} from "@storyblok/utils/rate-limiting";

export { createThrottle };

const FIXED_BUCKET = "fixed";

export interface RateLimitConfig {
  /**
   * Fixed number of requests to start per second. When set, disables automatic
   * per_page tier detection and all requests share a single per-second window
   * at this limit. Capped at 1000.
   */
  requestsPerSecond?: number;
  /**
   * @deprecated Use `requestsPerSecond` instead. This never capped simultaneous
   * in-flight requests despite its name; it is a per-second rate.
   * @todo(next-major): Remove this field.
   */
  maxConcurrency?: number;
  /**
   * Dynamically adjust the rate limit based on the `X-RateLimit-Policy`
   * response header returned by the Storyblok API.
   * @default true
   */
  adaptToServerHeaders?: boolean;
  /**
   * Adapt the rate to what the API actually sustains: back off multiplicatively
   * whenever a request is throttled, recover additively while none is.
   *
   * Rate limits are enforced per token, but each client instance paces itself
   * alone, so parallel builds or workers sharing a token overrun the quota
   * between them. Adaptation lets them settle at a rate the token sustains.
   * On its own it only lowers the rate; `cacheAware` is what can raise it.
   *
   * Pass an object to tune it, or `false` to pin each tier to its limit.
   * @default true
   */
  adaptive?: boolean | AdaptiveConfig;
  /**
   * Let a tier's rate rise above its limit while the CDN cache is serving the
   * traffic.
   *
   * The per-second tiers apply to requests that reach the origin. A request the
   * cache answers never gets there, so a tier whose responses are mostly cached
   * is paced by a limit that does not apply to most of them. With this on, the
   * client measures the share of its responses the cache served and raises the
   * tier by `1 / (1 - hitShare)` — twice the tier at a half-cached workload,
   * twenty times it at 95%, which is where the bound stops it. The requests
   * that do reach the origin stay within the tier either way.
   *
   * The cost is paid when a warm workload goes cold all at once, which is what
   * following a new content version does: the requests already in flight
   * overshoot the tier and come back as a bounded burst of 429s that the
   * back-off then absorbs. Set this to `false` to trade the throughput for
   * never exceeding the tier.
   *
   * Traffic the cache does not serve leaves the tier at its limit, which is
   * also what a browser sees: the cache status is not among the headers the API
   * exposes to cross-origin script. Ignored alongside `requestsPerSecond`,
   * which is an explicit rate, and when `adaptive` is `false`.
   * @default true
   */
  cacheAware?: boolean;
  /**
   * Called when a response changes the rate a tier is being paced at.
   *
   * Nothing else reports the rate, so without this a 429 burst can only be
   * explained by timing the requests. Failures are swallowed, and no
   * measurement is taken while this is unset.
   *
   * Not called for a custom `limiter`, which does its own pacing.
   */
  onRateLimitChange?: (status: RateLimitStatus) => void;
  /**
   * Replaces the in-memory limiter, which paces each instance independently.
   *
   * Supply one backed by shared storage (Redis, Upstash, …) to hold a fleet of
   * instances to a single quota proactively rather than by reacting to 429s.
   * `requestsPerSecond`, `adaptive`, `cacheAware`, `adaptToServerHeaders` and
   * `onRateLimitChange` do not apply to a custom limiter; the rate the client
   * would have used is passed to it as `context.limit`.
   */
  limiter?: RateLimiter;
}

export interface ThrottleManager extends RequestAdmission {
  /**
   * @deprecated Admission happens in `beforeRequest`, or in `wrapFetch` for a
   * caller that only wraps `fetch`; this only runs `fn`.
   * @todo(next-major): Remove this method.
   */
  execute: <T>(path: string, query: Record<string, unknown>, fn: () => Promise<T>) => Promise<T>;
  /**
   * @deprecated Responses reach the limiter through `wrapFetch`. This is a no-op.
   * @todo(next-major): Remove this method.
   */
  adaptToResponse: (response: Response | undefined) => void;
}

/** Reads the per-second rate the API advertises in `X-RateLimit-Policy`. */
export function parseRateLimitPolicyHeader(response: Response): number | undefined {
  return parseRateLimitPolicy(response.headers.get(RATE_LIMIT_POLICY_HEADER));
}

/**
 * Reads whether the CDN answered a response from its cache rather than from
 * the origin. Returns `undefined` when the response carries no cache status,
 * which is always the case in browsers: the API does not expose the header to
 * cross-origin script.
 */
export function parseCacheStatusHeader(response: Response): boolean | undefined {
  return parseCacheStatus(response.headers.get(CACHE_STATUS_HEADER));
}

/**
 * Creates a `ThrottleManager` from the user-supplied `rateLimit` config.
 *
 * - `false`                       → no throttling (passthrough)
 * - `number`                      → fixed single queue at that limit
 * - `{ requestsPerSecond: n }`     → fixed single queue at n req/s
 * - `{}` / `undefined` (default)   → auto-detect tier from path + per_page
 */
export function createThrottleManager(config: RateLimitConfig | number | false): ThrottleManager {
  // Disabled — every request goes straight through.
  if (config === false) {
    return createManager(createPassthroughRateLimiter(), () => ({
      path: "",
      query: {},
      bucket: FIXED_BUCKET,
      limit: Number.POSITIVE_INFINITY,
    }));
  }

  const resolvedConfig: RateLimitConfig =
    typeof config === "number" ? { requestsPerSecond: config } : config;
  const {
    requestsPerSecond,
    maxConcurrency,
    adaptToServerHeaders = true,
    adaptive = true,
    cacheAware = true,
    onRateLimitChange,
    limiter,
  } = resolvedConfig;
  // `maxConcurrency` is the deprecated alias for `requestsPerSecond`.
  const fixedLimit = requestsPerSecond ?? maxConcurrency;

  const toContext =
    fixedLimit !== undefined
      ? // Fixed-limit mode — one bucket, tier detection off.
        (path: string, query: Record<string, unknown>): RateLimitContext => ({
          path,
          query,
          bucket: FIXED_BUCKET,
          limit: Math.min(fixedLimit, MAX_RATE_LIMIT),
        })
      : // Auto-detect mode — one bucket per tier, tier chosen per request.
        (path: string, query: Record<string, unknown>): RateLimitContext => {
          const tier = determineRateLimitTier(path, query);
          return { path, query, bucket: tier, limit: RATE_LIMIT_TIERS[tier] };
        };

  const resolvedLimiter =
    limiter ??
    createDefaultRateLimiter({
      adaptive,
      onRateLimitChange,
      parseServerLimit: adaptToServerHeaders ? parseRateLimitPolicyHeader : undefined,
      cacheAware:
        cacheAware && fixedLimit === undefined
          ? {
              cachedRequestsPerSecond: MAX_RATE_LIMIT,
              detectCacheHit: parseCacheStatusHeader,
            }
          : undefined,
    });

  return createManager(resolvedLimiter, toContext);
}

function createManager(limiter: RateLimiter, toContext: RateLimitContextResolver): ThrottleManager {
  return {
    ...createRequestAdmission(limiter, toContext),
    execute: (_path, _query, fn) => fn(),
    adaptToResponse: () => {},
  };
}

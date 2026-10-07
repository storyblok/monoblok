import type { AdaptiveConfig, RateLimiter, RequestAdmission } from "@storyblok/utils/rate-limiting";
import {
  createDefaultRateLimiter,
  createPassthroughRateLimiter,
  createRequestAdmission,
  MAX_RATE_LIMIT,
} from "@storyblok/utils/rate-limiting";

const DEFAULT_REQUESTS_PER_SECOND = 6;
/** The Management API enforces one quota per token, so one bucket covers it. */
const BUCKET = "management-api";

export interface RateLimitConfig {
  /**
   * Maximum number of MAPI requests to start per second.
   * Defaults to 6. Capped at 1000.
   */
  requestsPerSecond?: number;
  /**
   * @deprecated Use `requestsPerSecond` instead.
   * @todo(next-major): Remove this field.
   */
  maxConcurrency?: number;
  /**
   * Adapt the rate to what the API actually sustains: back off multiplicatively
   * whenever a request is throttled, recover additively while none is.
   *
   * Rate limits are enforced per token, but each client instance paces itself
   * alone, so parallel builds or workers sharing a token overrun the quota
   * between them. Adaptation lets them settle at a rate the token sustains.
   * The limit never rises above the one the client would have used anyway.
   *
   * Pass an object to tune it, or `false` to pin the rate to `requestsPerSecond`.
   * @default true
   */
  adaptive?: boolean | AdaptiveConfig;
  /**
   * Replaces the in-memory limiter, which paces each instance independently.
   *
   * Supply one backed by shared storage (Redis, Upstash, …) to hold a fleet of
   * instances to a single quota proactively rather than by reacting to 429s.
   * `requestsPerSecond` and `adaptive` do not apply to a custom limiter; the
   * rate the client would have used is passed to it as `context.limit`.
   */
  limiter?: RateLimiter;
}

export interface ThrottleManager extends RequestAdmission {
  /**
   * @deprecated Admission happens in `beforeRequest`, or in `wrapFetch` for a
   * caller that only wraps `fetch`; this only runs `fn`.
   * @todo(next-major): Remove this method.
   */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Creates a `ThrottleManager` from the user-supplied `rateLimit` config.
 *
 * - `false`                       → no throttling (passthrough)
 * - `number`                      → N requests per second
 * - `{ requestsPerSecond: n }`    → N requests per second
 * - `{}` / `undefined` (default)  → DEFAULT_REQUESTS_PER_SECOND per second
 */
export function createThrottleManager(config: RateLimitConfig | number | false): ThrottleManager {
  if (config === false) {
    return createManager(createPassthroughRateLimiter(), Number.POSITIVE_INFINITY);
  }

  const resolvedConfig: RateLimitConfig =
    typeof config === "number" ? { requestsPerSecond: config } : config;
  const { requestsPerSecond, maxConcurrency, adaptive = true, limiter } = resolvedConfig;
  const rps = requestsPerSecond ?? maxConcurrency ?? DEFAULT_REQUESTS_PER_SECOND;

  return createManager(
    limiter ?? createDefaultRateLimiter({ adaptive }),
    Math.min(rps, MAX_RATE_LIMIT),
  );
}

function createManager(limiter: RateLimiter, limit: number): ThrottleManager {
  return {
    ...createRequestAdmission(limiter, (path, query) => ({ path, query, bucket: BUCKET, limit })),
    execute: (fn) => fn(),
  };
}

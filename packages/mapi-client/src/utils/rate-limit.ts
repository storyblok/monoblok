import type { AdaptiveConfig, RateLimitContext, RateLimiter } from "./limiter";
import { createDefaultRateLimiter, createPassthroughRateLimiter } from "./limiter";

const DEFAULT_REQUESTS_PER_SECOND = 6;
const MAX_RATE_LIMIT = 1_000;
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

export interface ThrottleManager {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /**
   * Wraps `fetch` so the limiter observes every HTTP response, including the
   * ones a retry replaced.
   */
  wrapFetch: (fetchFn: typeof globalThis.fetch) => typeof globalThis.fetch;
}

/** Resolves the URL a `fetch` call targets, whichever of its input forms was used. */
function getRequestUrl(input: RequestInfo | URL): string | undefined {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return typeof input === "object" && input !== null && "url" in input ? input.url : undefined;
}

function pathOf(url: string | undefined): string {
  if (url === undefined) {
    return "";
  }
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Creates a `ThrottleManager` from the user-supplied `rateLimit` config.
 *
 * - `false`                       -> no throttling (passthrough)
 * - `number`                      -> N requests per second
 * - `{ requestsPerSecond: n }`    -> N requests per second
 * - `{}` / `undefined` (default)  -> DEFAULT_REQUESTS_PER_SECOND per second
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
  // A request's path is only known at the `fetch` boundary, so admission is
  // decided from the quota alone — which is the whole of what MAPI enforces.
  const context: RateLimitContext = { path: "", query: {}, bucket: BUCKET, limit };

  return {
    execute: async (fn) => {
      await limiter.acquire(context);
      try {
        return await fn();
      } finally {
        await limiter.release?.(context);
      }
    },
    wrapFetch: (fetchFn) => {
      if (limiter.recordResponse === undefined) {
        return fetchFn;
      }

      return async (input, init) => {
        const response = await fetchFn(input, init);
        await limiter.recordResponse?.(
          { ...context, path: pathOf(getRequestUrl(input)) },
          response,
        );
        return response;
      };
    },
  };
}

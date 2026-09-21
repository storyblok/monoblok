/**
 * Rate limiting for the Content API client.
 *
 * Provides a tier-aware manager that selects the right per-second limit based
 * on request type (single story vs. listing) and the per_page query parameter,
 * mirroring the per-second tiers the Storyblok CDN enforces.
 */
import { createThrottle } from "./throttle";
import type { RateLimitContext, RateLimiter } from "./limiter";
import { createDefaultRateLimiter, createPassthroughRateLimiter } from "./limiter";
import type { AdaptiveConfig } from "./limiter";

export { createThrottle };

const TIER_LIMITS = {
  SINGLE_OR_SMALL: 50, // single story fetch or per_page ≤ 25
  MEDIUM: 15, // per_page 26–50
  LARGE: 10, // per_page 51–75
  VERY_LARGE: 6, // per_page 76–100
} as const;

type TierName = keyof typeof TIER_LIMITS;

const PER_PAGE_THRESHOLDS = {
  SMALL: 25,
  MEDIUM: 50,
  LARGE: 75,
} as const;

const DEFAULT_PER_PAGE = 25;
const MAX_RATE_LIMIT = 1_000;
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
   * The limit never rises above the one the client would have used anyway.
   *
   * Pass an object to tune it, or `false` to pin each tier to its limit.
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
  /**
   * @deprecated Admission happens in `wrapFetch`; this only runs `fn`.
   * @todo(next-major): Remove this method.
   */
  execute: <T>(path: string, query: Record<string, unknown>, fn: () => Promise<T>) => Promise<T>;
  /**
   * Wraps `fetch` so the limiter admits, observes and releases every HTTP
   * request — retries included.
   */
  wrapFetch: (fetchFn: typeof globalThis.fetch) => typeof globalThis.fetch;
  /**
   * @deprecated Responses reach the limiter through `wrapFetch`. This is a no-op.
   * @todo(next-major): Remove this method.
   */
  adaptToResponse: (response: Response | undefined) => void;
}

// Matches /v2/cdn/stories/<identifier> — a single story fetch (including nested slugs).
const SINGLE_STORY_PATH_RE = /\/v2\/cdn\/stories\/.+$/;

/**
 * Maps a request path + query to one of the four rate-limit tiers.
 * Used by the auto-detection mode of `createThrottleManager`.
 */
export function determineTier(path: string, query: Record<string, unknown>): TierName {
  if (SINGLE_STORY_PATH_RE.test(path)) {
    return "SINGLE_OR_SMALL";
  }

  const rawPerPage = query.per_page;
  const perPage =
    typeof rawPerPage === "number"
      ? rawPerPage
      : typeof rawPerPage === "string"
        ? Number.parseInt(rawPerPage, 10) || DEFAULT_PER_PAGE
        : DEFAULT_PER_PAGE;

  if (perPage <= PER_PAGE_THRESHOLDS.SMALL) {
    return "SINGLE_OR_SMALL";
  }
  if (perPage <= PER_PAGE_THRESHOLDS.MEDIUM) {
    return "MEDIUM";
  }
  if (perPage <= PER_PAGE_THRESHOLDS.LARGE) {
    return "LARGE";
  }
  return "VERY_LARGE";
}

/** Policy names ending in this describe a cap on simultaneous requests, not a rate. */
const CONCURRENCY_POLICY_SUFFIX = "concurrent-requests";

/**
 * Extracts the quota (`q=`) value from the `X-RateLimit-Policy` response header,
 * but only when the policy describes a rate limit rather than a concurrency one.
 *
 * The API reports a cap on simultaneous requests under this header too, under
 * names such as `"space-concurrent-requests";q=30`. That quota is not a rate,
 * and adopting it as one would cap throughput far below what the API allows.
 */
export function parseRateLimitPolicyHeader(response: Response): number | undefined {
  const policy = response.headers.get("x-ratelimit-policy");
  if (!policy) {
    return undefined;
  }

  // Match the quoted policy name rather than searching for a fixed string: the
  // name carries a prefix, so `"space-concurrent-requests"` has to be caught by
  // its ending and not by an equality that only `"concurrent-requests"` meets.
  const name = policy.match(/"([^"]+)"/)?.[1];
  if (name === undefined || name.endsWith(CONCURRENCY_POLICY_SUFFIX)) {
    return undefined;
  }

  const match = policy.match(/q=(\d+)/);
  if (!match) {
    return undefined;
  }
  return Math.min(Number.parseInt(match[1], 10), MAX_RATE_LIMIT);
}

function getRequestUrl(input: RequestInfo | URL): string | undefined {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return typeof input === "object" && input !== null && "url" in input ? input.url : undefined;
}

/** Query parameters that carry credentials and must not reach a limiter. */
const CREDENTIAL_PARAMS = new Set(["token"]);

/**
 * Builds the limiter context from an outgoing request.
 *
 * The context is derived from the URL rather than carried alongside the call so
 * that it stays correct when several requests are in flight at once.
 */
function contextFromUrl(
  url: string | undefined,
  toContext: (path: string, query: Record<string, unknown>) => RateLimitContext,
): RateLimitContext {
  if (url === undefined) {
    return toContext("", {});
  }

  try {
    const parsed = new URL(url);
    const query: Record<string, unknown> = {};
    for (const [key, value] of parsed.searchParams) {
      if (!CREDENTIAL_PARAMS.has(key)) {
        query[key] = value;
      }
    }
    return toContext(parsed.pathname, query);
  } catch {
    return toContext(url, {});
  }
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
          const tier = determineTier(path, query);
          return { path, query, bucket: tier, limit: TIER_LIMITS[tier] };
        };

  const resolvedLimiter =
    limiter ??
    createDefaultRateLimiter({
      adaptive,
      parseServerLimit: adaptToServerHeaders ? parseRateLimitPolicyHeader : undefined,
    });

  return createManager(resolvedLimiter, toContext);
}

function createManager(
  limiter: RateLimiter,
  toContext: (path: string, query: Record<string, unknown>) => RateLimitContext,
): ThrottleManager {
  return {
    execute: (_path, _query, fn) => fn(),
    wrapFetch: (fetchFn) => async (input, init) => {
      // Admission sits here rather than around the call because the HTTP layer
      // retries inside one call: gating the call alone would let one admitted
      // request put `retry.limit + 1` requests on the wire during a 429 storm.
      const context = contextFromUrl(getRequestUrl(input), toContext);
      await limiter.acquire(context);

      try {
        const response = await fetchFn(input, init);
        // The limiter gets a copy: reading the body of the response the caller
        // is waiting for would consume it.
        await report(() => limiter.recordResponse?.(context, response.clone()));
        return response;
      } finally {
        await report(() => limiter.release?.(context));
      }
    },
    adaptToResponse: () => {},
  };
}

/**
 * Swallows a reporting hook's failure. Shared storage can fail transiently, and
 * neither recording a response nor releasing a slot may turn a served request
 * into an error, or, inside the retry loop, into another request.
 */
async function report(hook: () => void | Promise<void>): Promise<void> {
  try {
    await hook();
  } catch {
    // Intentionally ignored.
  }
}

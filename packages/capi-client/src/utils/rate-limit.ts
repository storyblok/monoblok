/**
 * Rate limiting for the Content API client.
 *
 * Provides a tier-aware manager that selects the right per-second limit based
 * on request type (single story vs. listing) and the per_page query parameter,
 * mirroring the per-second tiers the Storyblok CDN enforces.
 */
import { createThrottle, type Throttle } from './throttle';

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
}

export interface ThrottleManager {
  execute: <T>(path: string, query: Record<string, unknown>, fn: () => Promise<T>) => Promise<T>;
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
    return 'SINGLE_OR_SMALL';
  }

  const rawPerPage = query.per_page;
  const perPage
    = typeof rawPerPage === 'number'
      ? rawPerPage
      : typeof rawPerPage === 'string'
        ? Number.parseInt(rawPerPage, 10) || DEFAULT_PER_PAGE
        : DEFAULT_PER_PAGE;

  if (perPage <= PER_PAGE_THRESHOLDS.SMALL) {
    return 'SINGLE_OR_SMALL';
  }
  if (perPage <= PER_PAGE_THRESHOLDS.MEDIUM) {
    return 'MEDIUM';
  }
  if (perPage <= PER_PAGE_THRESHOLDS.LARGE) {
    return 'LARGE';
  }
  return 'VERY_LARGE';
}

/**
 * Extracts the quota (`q=`) value from the `X-RateLimit-Policy` response header,
 * but only when the policy describes a rate limit — not a concurrency limit.
 *
 * The Storyblok CDN currently returns `"concurrent-requests";q=30` which is a
 * concurrency limit (always ~30), not a rate limit. Applying that value to the
 * tier-based rate limiter would incorrectly cap throughput below what the API
 * allows. This function therefore ignores concurrency policies and only returns
 * a value for rate-limit policies (e.g. `"rate-limit";q=50`), which the API
 * does not send yet but may in the future.
 */
export function parseRateLimitPolicyHeader(response: Response): number | undefined {
  const policy = response.headers.get('x-ratelimit-policy');
  if (!policy) {
    return undefined;
  }
  // Only act on rate-limit policies — skip concurrency limits like
  // "concurrent-requests";q=30 which represent a different constraint.
  if (policy.includes('"concurrent-requests"')) {
    return undefined;
  }
  const match = policy.match(/q=(\d+)/);
  if (!match) {
    return undefined;
  }
  return Math.min(Number.parseInt(match[1], 10), MAX_RATE_LIMIT);
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
    return {
      execute: (_path, _query, fn) => fn(),
      adaptToResponse: () => {},
    };
  }

  const resolvedConfig: RateLimitConfig = typeof config === 'number' ? { requestsPerSecond: config } : config;
  const { requestsPerSecond, maxConcurrency, adaptToServerHeaders = true } = resolvedConfig;
  // `maxConcurrency` is the deprecated alias for `requestsPerSecond`.
  const fixedLimit = requestsPerSecond ?? maxConcurrency;

  // Fixed-limit mode — single queue, optional server-header adaptation.
  if (fixedLimit !== undefined) {
    const cappedLimit = Math.min(fixedLimit, MAX_RATE_LIMIT);
    const throttle = createThrottle(cappedLimit);

    return {
      execute: (_path, _query, fn) => throttle.execute(fn),
      adaptToResponse: (response) => {
        if (!adaptToServerHeaders || response === undefined) {
          return;
        }
        const serverLimit = parseRateLimitPolicyHeader(response);
        if (serverLimit !== undefined) {
          // Never exceed the user-configured ceiling.
          throttle.setLimit(Math.min(cappedLimit, serverLimit));
        }
      },
    };
  }

  // Auto-detect mode — one throttle per tier, tier chosen per request.
  const throttles: Record<TierName, Throttle> = {
    SINGLE_OR_SMALL: createThrottle(TIER_LIMITS.SINGLE_OR_SMALL),
    MEDIUM: createThrottle(TIER_LIMITS.MEDIUM),
    LARGE: createThrottle(TIER_LIMITS.LARGE),
    VERY_LARGE: createThrottle(TIER_LIMITS.VERY_LARGE),
  };

  return {
    execute: (path, query, fn) => {
      const tier = determineTier(path, query);
      return throttles[tier].execute(fn);
    },
    adaptToResponse: (response) => {
      if (!adaptToServerHeaders || response === undefined) {
        return;
      }
      const serverLimit = parseRateLimitPolicyHeader(response);
      if (serverLimit !== undefined) {
        // The SINGLE_OR_SMALL tier is the most common; adapting it covers the
        // majority of requests. Other tiers are already conservatively limited.
        throttles.SINGLE_OR_SMALL.setLimit(Math.min(TIER_LIMITS.SINGLE_OR_SMALL, serverLimit));
      }
    },
  };
}

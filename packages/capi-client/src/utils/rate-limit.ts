/**
 * Rate limiting for the Content API client.
 *
 * Provides a tier-aware manager that selects the right per-second limit based
 * on request type (single story vs. listing) and the per_page query parameter,
 * mirroring the per-second tiers the Storyblok CDN enforces.
 */
import { createThrottle } from "./throttle";
import type { RateLimitContext, RateLimiter } from "./limiter";
import {
  clampRequestsPerSecond,
  createDefaultRateLimiter,
  createPassthroughRateLimiter,
} from "./limiter";
import type { AdaptiveConfig, RateLimitStatus } from "./limiter";

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
   * eight times it at seven-eighths, which is where the bound stops it. The
   * requests that do reach the origin stay within the tier either way.
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

export interface ThrottleManager {
  /**
   * @deprecated Admission happens in `beforeRequest`, or in `wrapFetch` for a
   * caller that only wraps `fetch`; this only runs `fn`.
   * @todo(next-major): Remove this method.
   */
  execute: <T>(path: string, query: Record<string, unknown>, fn: () => Promise<T>) => Promise<T>;
  /**
   * Waits for the limiter to admit one request. Register it as a hook that runs
   * before the HTTP layer starts its timeout, so a queue longer than the
   * timeout delays requests instead of failing them.
   */
  beforeRequest: (request: Request) => Promise<void>;
  /**
   * Wraps `fetch` so the limiter observes and releases every HTTP request —
   * retries included — and admits the ones `beforeRequest` did not.
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
/** One member of the policy list: a quoted name followed by its own `;k=v` parameters. */
const POLICY_MEMBER = /"([^"]+)"((?:;[^,]*)*)/g;

/**
 * Reads the per-second rate the API advertises in `X-RateLimit-Policy`.
 *
 * The header carries one or more comma-separated policies, each a quoted name
 * followed by its parameters: a quota (`q`) and the window in seconds it
 * applies over (`w`). The rate is `q/w`, so a quota means nothing without its
 * window, and a policy carrying only a quota is skipped.
 *
 * Some policies cap simultaneous requests rather than a rate. Their quota is a
 * count, and adopting it as a rate would throttle far below what the API
 * allows.
 */
/**
 * Longest window whose quota still describes a rate rather than a budget. A
 * daily allowance spread evenly would pace far below the rate the same header
 * advertises for the second, and exhausting an allowance surfaces as the
 * throttled responses the back-off already answers.
 */
const MAX_POLICY_WINDOW_SECONDS = 60;

export function parseRateLimitPolicyHeader(response: Response): number | undefined {
  const policy = response.headers.get("x-ratelimit-policy");
  if (!policy) {
    return undefined;
  }

  // Exceeding any of the advertised policies gets the request throttled, so the
  // strictest one governs. Reading only the first would let the order the
  // header happens to list them in decide the rate.
  let strictest: number | undefined;
  for (const [, name, params] of policy.matchAll(POLICY_MEMBER)) {
    if (name!.endsWith(CONCURRENCY_POLICY_SUFFIX)) {
      continue;
    }

    const quota = Number(params!.match(/;q=(\d+)/)?.[1]);
    const windowSeconds = Number(params!.match(/;w=(\d+)/)?.[1]);
    if (!quota || !windowSeconds || windowSeconds > MAX_POLICY_WINDOW_SECONDS) {
      continue;
    }

    const rate = quota / windowSeconds;
    strictest = strictest === undefined ? rate : Math.min(strictest, rate);
  }

  if (strictest === undefined) {
    return undefined;
  }

  return Math.min(clampRequestsPerSecond(Math.floor(strictest)), MAX_RATE_LIMIT);
}

/**
 * A revalidated entry is reported with its own status ("RefreshHit"), and that
 * revalidation reaches the origin, so only a plain hit is free.
 */
const CACHE_HIT_STATUS = "hit";
/** One status per cache the response passed through, joined as a header list. */
const CACHE_STATUS_SEPARATOR = /\s*,\s*/;
/** A status is its own word followed by the cache that produced it: `Hit from cloudfront`. */
const CACHE_STATUS_WORDS = /\s+/;

/**
 * Reads whether the CDN answered a response from its cache rather than from
 * the origin.
 *
 * A response that passed through more than one cache carries one status per
 * hop, which arrives as a single comma-joined value. It only spared the origin
 * if every hop served it, so each is matched as a whole word — a substring
 * match would make the answer depend on which hop happened to be listed first.
 *
 * Returns `undefined` when the response carries no cache status. Browsers are
 * the case that matters: the header is not among the ones the API exposes to
 * cross-origin script, so a browser client can never observe a hit and stays
 * at the origin tier.
 */
export function parseCacheStatusHeader(response: Response): boolean | undefined {
  const header = response.headers.get("x-cache");
  if (header === null) {
    return undefined;
  }

  const statuses = header.trim().split(CACHE_STATUS_SEPARATOR).filter(Boolean);
  if (statuses.length === 0) {
    return undefined;
  }

  return statuses.every(
    (status) => status.split(CACHE_STATUS_WORDS)[0]?.toLowerCase() === CACHE_HIT_STATUS,
  );
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
    // A URL that will not parse must still not hand a token to a custom
    // limiter, so the query is dropped rather than passed through unread.
    return toContext(url.split("?")[0] ?? url, {});
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
          const tier = determineTier(path, query);
          return { path, query, bucket: tier, limit: TIER_LIMITS[tier] };
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

function createManager(
  limiter: RateLimiter,
  toContext: (path: string, query: Record<string, unknown>) => RateLimitContext,
): ThrottleManager {
  // Each attempt is admitted separately, because the HTTP layer retries inside
  // one call: gating the call alone would let one admitted request put
  // `retry.limit + 1` requests on the wire during a 429 storm. The request
  // carries its context from admission to response so that a limiter pairing a
  // release to its acquire by identity finds the one it admitted.
  const admitted = new WeakMap<Request, RateLimitContext>();

  const admit = async (url: string | undefined): Promise<RateLimitContext> => {
    const context = contextFromUrl(url, toContext);
    await limiter.acquire(context);
    return context;
  };

  return {
    execute: (_path, _query, fn) => fn(),
    beforeRequest: async (request) => {
      admitted.set(request, await admit(request.url));
    },
    wrapFetch: (fetchFn) => async (input, init) => {
      // Queueing here would count against the request timeout, so admission
      // belongs in `beforeRequest`. Waiting for it here regardless keeps a
      // caller that only wraps `fetch` paced rather than unthrottled.
      const context =
        (input instanceof Request ? admitted.get(input) : undefined) ??
        (await admit(getRequestUrl(input)));

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

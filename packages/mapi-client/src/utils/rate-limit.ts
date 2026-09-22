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
  /**
   * @deprecated Admission happens in `wrapFetch`; this only runs `fn`.
   * @todo(next-major): Remove this method.
   */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /**
   * Wraps `fetch` so the limiter admits, observes and releases every HTTP
   * request — retries included.
   */
  wrapFetch: (fetchFn: typeof globalThis.fetch) => typeof globalThis.fetch;
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
 * Splits an outgoing request URL into the path and query a limiter is given.
 *
 * A URL that will not parse must still not hand a token to a custom limiter,
 * so the query is dropped rather than passed through unread.
 */
function requestParts(url: string | undefined): { path: string; query: Record<string, unknown> } {
  if (url === undefined) {
    return { path: "", query: {} };
  }

  try {
    const parsed = new URL(url);
    const query: Record<string, unknown> = {};
    for (const [key, value] of parsed.searchParams) {
      if (!CREDENTIAL_PARAMS.has(key)) {
        query[key] = value;
      }
    }
    return { path: parsed.pathname, query };
  } catch {
    return { path: url, query: {} };
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
  return {
    execute: (fn) => fn(),
    wrapFetch: (fetchFn) => async (input, init) => {
      // Admission sits here rather than around the call because the HTTP layer
      // retries inside one call: with the default `retry.limit` of 12, gating
      // the call alone would let one admitted request put 13 on the wire.
      const context: RateLimitContext = {
        ...requestParts(getRequestUrl(input)),
        bucket: BUCKET,
        limit,
      };
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

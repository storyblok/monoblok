// This file is duplicated verbatim in @storyblok/api-client and
// @storyblok/management-api-client. The two copies must stay identical; apply
// any change to both. It is intentionally not extracted into a shared package
// so the two independently published clients keep no shared runtime dependency.

import { createThrottle, type Throttle } from "./throttle";

/**
 * Describes the request a limiter is being asked to admit.
 */
export interface RateLimitContext {
  /** Request path, e.g. `/v2/cdn/stories/home`. */
  path: string;
  /** Query parameters of the request. */
  query: Record<string, unknown>;
  /**
   * Name of the quota this request draws from. The Content API client buckets
   * per rate-limit tier; the Management API client uses a single bucket.
   */
  bucket: string;
  /**
   * Requests per second the client would allow for this bucket on its own.
   *
   * A custom limiter coordinating several instances against one token divides
   * this by the number of instances rather than hard-coding a limit that would
   * have to be the lowest tier's to stay safe.
   */
  limit: number;
}

/**
 * Admission control for outgoing requests.
 *
 * The client calls `acquire` before every request and `release` once it has
 * settled. `recordResponse` is called for every HTTP response the request
 * produced, including the ones a retry replaced — a limiter that only saw the
 * final response would miss most of the throttling it is meant to react to.
 *
 * Implement this to coordinate a fleet of clients sharing one token, for
 * example against Redis. The in-memory default applies per-second windows
 * local to the instance.
 */
export interface RateLimiter {
  /** Resolves when the request may start. */
  acquire: (context: RateLimitContext) => Promise<void>;
  /** Reports an HTTP response the request produced. */
  recordResponse?: (context: RateLimitContext, response: Response) => void | Promise<void>;
  /** Reports that the request settled, whether or not it succeeded. */
  release?: (context: RateLimitContext) => void | Promise<void>;
}

/**
 * Tuning for the additive-increase/multiplicative-decrease adaptation applied
 * by the default limiter.
 */
export interface AdaptiveConfig {
  /**
   * Fraction the effective limit drops to when a request is throttled.
   * @default 0.5
   */
  decreaseFactor?: number;
  /**
   * Requests per second added back per `recoveryIntervalMs` of sustained success.
   * @default 1
   */
  increaseStep?: number;
  /**
   * How long the limit must hold without being throttled before it recovers.
   * @default 1000
   */
  recoveryIntervalMs?: number;
  /**
   * Floor the effective limit never drops below.
   * @default 1
   */
  minRequestsPerSecond?: number;
  /**
   * Shortest spacing between two decreases of the same bucket. A burst of
   * responses throttled by one overloaded window describes a single event, so
   * without this the limit would collapse to the floor on the first burst.
   * @default 1000
   */
  decreaseCooldownMs?: number;
}

const ADAPTIVE_DEFAULTS: Required<AdaptiveConfig> = {
  decreaseFactor: 0.5,
  increaseStep: 1,
  recoveryIntervalMs: 1000,
  minRequestsPerSecond: 1,
  decreaseCooldownMs: 1000,
};

/** Statuses that mean the request was refused for exceeding a quota. */
const THROTTLED_STATUSES = new Set([429, 503]);

export interface DefaultRateLimiterOptions {
  /** AIMD adaptation. `false` pins every bucket to its base limit. @default true */
  adaptive?: boolean | AdaptiveConfig;
  /**
   * Lowers a bucket's ceiling to the quota advertised by a response header.
   * Returns `undefined` when the response carries no applicable quota.
   */
  parseServerLimit?: (response: Response) => number | undefined;
}

interface Bucket {
  throttle: Throttle;
  /** Ceiling the effective limit recovers towards; never exceeded. */
  baseLimit: number;
  lastDecreaseAt: number;
  lastIncreaseAt: number;
}

/**
 * Creates the in-memory limiter used unless the caller supplies its own.
 *
 * Each bucket gets a per-second window sized by `context.limit`. With adaptation
 * enabled the window shrinks multiplicatively whenever the API throttles a
 * request and recovers additively while it does not, so several instances
 * sharing one token converge on a rate the token actually sustains instead of
 * each pacing itself as though it were alone. The limit only ever moves between
 * the floor and the limit the client would have used anyway.
 */
export function createDefaultRateLimiter(options: DefaultRateLimiterOptions = {}): RateLimiter {
  const { adaptive = true, parseServerLimit } = options;
  const adaptiveConfig: Required<AdaptiveConfig> = {
    ...ADAPTIVE_DEFAULTS,
    ...(typeof adaptive === "object" ? adaptive : {}),
  };
  const adaptationEnabled = adaptive !== false;
  const buckets = new Map<string, Bucket>();

  const getBucket = (context: RateLimitContext): Bucket => {
    const existing = buckets.get(context.bucket);
    if (existing) {
      return existing;
    }

    const bucket: Bucket = {
      throttle: createThrottle(context.limit),
      baseLimit: context.limit,
      lastDecreaseAt: Number.NEGATIVE_INFINITY,
      lastIncreaseAt: Number.NEGATIVE_INFINITY,
    };
    buckets.set(context.bucket, bucket);
    return bucket;
  };

  const decrease = (bucket: Bucket, now: number) => {
    if (now - bucket.lastDecreaseAt < adaptiveConfig.decreaseCooldownMs) {
      return;
    }

    const current = bucket.throttle.getLimit();
    const next = Math.max(
      adaptiveConfig.minRequestsPerSecond,
      Math.floor(current * adaptiveConfig.decreaseFactor),
    );
    bucket.lastDecreaseAt = now;
    // Recovery is measured from the decrease, so a limit that was just cut
    // holds for a full interval before it starts climbing back.
    bucket.lastIncreaseAt = now;
    bucket.throttle.setLimit(next);
  };

  const increase = (bucket: Bucket, now: number) => {
    const current = bucket.throttle.getLimit();
    if (current >= bucket.baseLimit) {
      return;
    }
    if (now - bucket.lastIncreaseAt < adaptiveConfig.recoveryIntervalMs) {
      return;
    }

    bucket.lastIncreaseAt = now;
    bucket.throttle.setLimit(Math.min(bucket.baseLimit, current + adaptiveConfig.increaseStep));
  };

  const applyServerLimit = (bucket: Bucket, response: Response) => {
    const serverLimit = parseServerLimit?.(response);
    if (serverLimit === undefined) {
      return;
    }

    bucket.baseLimit = Math.min(bucket.baseLimit, serverLimit);
    if (bucket.throttle.getLimit() > bucket.baseLimit) {
      bucket.throttle.setLimit(bucket.baseLimit);
    }
  };

  return {
    acquire: (context) => getBucket(context).throttle.acquire(),
    recordResponse: (context, response) => {
      const bucket = getBucket(context);
      applyServerLimit(bucket, response);

      if (!adaptationEnabled) {
        return;
      }

      const now = Date.now();
      if (THROTTLED_STATUSES.has(response.status)) {
        decrease(bucket, now);
        return;
      }
      if (response.ok) {
        increase(bucket, now);
      }
    },
  };
}

/** A limiter that admits every request immediately. */
export function createPassthroughRateLimiter(): RateLimiter {
  return { acquire: () => Promise.resolve() };
}

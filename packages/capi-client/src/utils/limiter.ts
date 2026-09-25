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
  /** Query parameters of the request, less the access token. */
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
 * Implement this to coordinate a fleet of clients sharing one token, for
 * example against Redis. The in-memory default applies per-second windows local
 * to the instance.
 *
 * The three hooks are called once per HTTP request, retries included, and are
 * handed the same context object so a limiter can pair a release to its
 * acquire. A rejection from `acquire` fails the request; one from either
 * reporting hook is swallowed, so a blip in shared storage cannot turn a served
 * request into an error.
 */
export interface RateLimiter {
  /**
   * Resolves when the request may start. Nothing times this out, so a limiter
   * that can stall must impose its own deadline.
   */
  acquire: (context: RateLimitContext) => Promise<void>;
  /**
   * Reports a response, including one a retry went on to replace — a limiter
   * that only saw a request's last response would miss most of the throttling
   * it is meant to react to.
   *
   * The response is a clone, so reading its body is safe.
   */
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
   * Fraction the effective limit drops to when a request is throttled. A value
   * outside `(0, 1)` would make a back-off an increase, and falls back to the
   * default.
   * @default 0.5
   */
  decreaseFactor?: number;
  /**
   * Requests per second added back per `recoveryIntervalMs` of sustained
   * success. Defaults to a twenty-fifth of the bucket's ceiling, at least 1, so
   * that recovery takes about as long on a 50/s tier as on a 6/s one.
   */
  increaseStep?: number;
  /**
   * How long the limit must hold without being throttled before it recovers.
   * @default 1000
   */
  recoveryIntervalMs?: number;
  /**
   * Floor the effective limit never drops below. Values below 1 are raised to
   * 1: a rate of zero reads as "no limit" to the underlying window, which would
   * turn a back-off into no pacing at all.
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

const ADAPTIVE_DEFAULTS: Required<Omit<AdaptiveConfig, "increaseStep">> = {
  decreaseFactor: 0.5,
  recoveryIntervalMs: 1000,
  minRequestsPerSecond: 1,
  decreaseCooldownMs: 1000,
};

/** A bucket recovers its whole rate in approximately this many intervals. */
const RECOVERY_INTERVALS = 25;

/** 503 is excluded: it reports an upstream problem that backing off would not address. */
const THROTTLED_STATUS = 429;

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
  /** Rate the client asked for. */
  configuredLimit: number;
  /** Most recent quota a response advertised, if any. */
  serverLimit?: number;
  lastDecreaseAt: number;
  lastIncreaseAt: number;
}

/** Ceiling the effective limit recovers towards; never exceeded. */
const ceilingOf = (bucket: Bucket): number =>
  Math.min(bucket.configuredLimit, bucket.serverLimit ?? Number.POSITIVE_INFINITY);

/**
 * Rejects a non-finite tuning value before it reaches `Math.max`, which
 * propagates `NaN` rather than bounding it.
 */
const finiteOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback;

/**
 * Creates the in-memory limiter used unless the caller supplies its own.
 *
 * Each bucket gets a per-second window sized by `context.limit`, shrinking
 * multiplicatively on a throttled response and recovering additively while none
 * is, bounded by the floor and by `context.limit`.
 */
export function createDefaultRateLimiter(options: DefaultRateLimiterOptions = {}): RateLimiter {
  const { adaptive = true, parseServerLimit } = options;
  const configured = typeof adaptive === "object" ? adaptive : {};
  const requestedDecrease = configured.decreaseFactor ?? ADAPTIVE_DEFAULTS.decreaseFactor;
  const adaptiveConfig = {
    ...ADAPTIVE_DEFAULTS,
    ...configured,
    decreaseFactor:
      requestedDecrease > 0 && requestedDecrease < 1
        ? requestedDecrease
        : ADAPTIVE_DEFAULTS.decreaseFactor,
    increaseStep:
      configured.increaseStep === undefined
        ? undefined
        : Math.max(0, finiteOr(configured.increaseStep, 0)),
    recoveryIntervalMs: finiteOr(
      configured.recoveryIntervalMs,
      ADAPTIVE_DEFAULTS.recoveryIntervalMs,
    ),
    decreaseCooldownMs: finiteOr(
      configured.decreaseCooldownMs,
      ADAPTIVE_DEFAULTS.decreaseCooldownMs,
    ),
    minRequestsPerSecond: Math.max(1, finiteOr(configured.minRequestsPerSecond, 1)),
  };

  const stepFor = (ceiling: number) =>
    adaptiveConfig.increaseStep ?? Math.max(1, Math.round(ceiling / RECOVERY_INTERVALS));
  const adaptationEnabled = adaptive !== false;
  const buckets = new Map<string, Bucket>();

  const getBucket = (context: RateLimitContext): Bucket => {
    const existing = buckets.get(context.bucket);
    if (existing) {
      return existing;
    }

    const bucket: Bucket = {
      throttle: createThrottle(context.limit),
      configuredLimit: context.limit,
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
    const next = Math.min(
      ceilingOf(bucket),
      Math.max(
        adaptiveConfig.minRequestsPerSecond,
        Math.floor(current * adaptiveConfig.decreaseFactor),
      ),
    );
    bucket.lastDecreaseAt = now;
    // Recovery is measured from the decrease, so a limit that was just cut
    // holds for a full interval before it starts climbing back.
    bucket.lastIncreaseAt = now;
    bucket.throttle.setLimit(next);
  };

  const increase = (bucket: Bucket, now: number) => {
    const ceiling = ceilingOf(bucket);
    const current = bucket.throttle.getLimit();
    if (current >= ceiling) {
      return;
    }
    if (now - bucket.lastIncreaseAt < adaptiveConfig.recoveryIntervalMs) {
      return;
    }

    bucket.lastIncreaseAt = now;
    bucket.throttle.setLimit(Math.min(ceiling, current + stepFor(ceiling)));
  };

  const applyServerLimit = (bucket: Bucket, response: Response) => {
    let serverLimit: number | undefined;
    try {
      serverLimit = parseServerLimit?.(response);
    } catch {
      // A parser that throws must not also cost the response its back-off.
      return;
    }
    if (serverLimit === undefined) {
      return;
    }

    // The latest response's quota replaces the previous one. Ratcheting it down
    // instead would pin the client to the lowest quota it ever saw.
    bucket.serverLimit = Math.max(
      adaptiveConfig.minRequestsPerSecond,
      finiteOr(serverLimit, adaptiveConfig.minRequestsPerSecond),
    );
    const ceiling = ceilingOf(bucket);
    if (!adaptationEnabled || bucket.throttle.getLimit() > ceiling) {
      bucket.throttle.setLimit(ceiling);
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
      if (response.status === THROTTLED_STATUS) {
        decrease(bucket, now);
        return;
      }
      // Any answer that is not a refusal counts as the quota holding, a 404
      // among them: recovering only on 2xx would strand a client whose workload
      // legitimately produces other statuses.
      increase(bucket, now);
    },
  };
}

/** A limiter that admits every request immediately. */
export function createPassthroughRateLimiter(): RateLimiter {
  return { acquire: () => Promise.resolve() };
}

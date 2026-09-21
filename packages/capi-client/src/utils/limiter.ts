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

/**
 * Lets a bucket's ceiling rise above its configured limit while an edge cache
 * is absorbing the traffic, instead of pinning it to the origin's quota.
 *
 * Both fields are required, so the mechanism is inert wherever it is not
 * configured — an API with no cache in front of it never opts in.
 */
export interface CacheAwareConfig {
  /**
   * Highest rate the cache is assumed able to serve; the ceiling never passes it.
   *
   * It is an outer bound, not the operating one: eight times a bucket's own
   * limit binds first on every bucket under an eighth of this.
   */
  cachedRequestsPerSecond: number;
  /**
   * Whether the response was served from cache without reaching the origin.
   *
   * Returns `undefined` when the response carries no such signal, which keeps
   * the bucket at its configured limit. A runtime that hides the header — a
   * browser, for one — therefore never leaves that limit.
   */
  detectCacheHit: (response: Response) => boolean | undefined;
}

/**
 * What a bucket's pacing looks like after a response has been accounted for.
 */
export interface RateLimitStatus {
  /** Quota the request drew from, as `context.bucket` named it. */
  bucket: string;
  /** Requests per second the bucket is admitting right now. */
  requestsPerSecond: number;
  /** Highest rate the bucket may recover to. */
  ceiling: number;
  /** Rate the bucket would be paced at with no adaptation at all. */
  configuredLimit: number;
  /**
   * Share of the observed responses the cache served, between 0 and 1.
   *
   * `undefined` while the bucket has no cache measurement to report: cache
   * awareness is off, or no response has carried a readable cache status.
   */
  cacheHitShare: number | undefined;
}

/** Lowest rate that still paces anything. */
const MIN_REQUESTS_PER_SECOND = 1;

/**
 * Makes a rate safe to hand to a per-second window.
 *
 * A window reads a rate of zero as "no limit", so a rate that floors, divides
 * or rounds its way down to zero turns pacing off altogether — the opposite of
 * what every caller computing one intends. `NaN` does the same by propagating
 * through the comparisons that would otherwise bound it. Every rate derived
 * from arithmetic, whether from a configured value, a response header or a
 * measured share, passes through here before it reaches a window.
 */
export function clampRequestsPerSecond(rate: number, minimum = MIN_REQUESTS_PER_SECOND): number {
  return Number.isFinite(rate) ? Math.max(minimum, rate) : minimum;
}

const ADAPTIVE_DEFAULTS: Required<Omit<AdaptiveConfig, "increaseStep">> = {
  decreaseFactor: 0.5,
  recoveryIntervalMs: 1000,
  minRequestsPerSecond: MIN_REQUESTS_PER_SECOND,
  decreaseCooldownMs: 1000,
};

/** A bucket recovers its whole rate in approximately this many intervals. */
const RECOVERY_INTERVALS = 25;

/**
 * Responses a bucket's cache-hit share is measured over. The ceiling only
 * leaves the configured limit once this many have been observed, and a run of
 * origin-served responses flushes the window in the same number again.
 */
const CACHE_SAMPLE_WINDOW = 50;

/**
 * How unlikely a run of origin-served responses has to be, under the hit share
 * the bucket has been measuring, before it is read as the traffic going cold
 * rather than as the ordinary clustering of a mixed workload.
 */
const COLD_RUN_IMPROBABILITY = 1e-5;

/** Runs shorter than the minimum are never a cold run; a mostly-missing bucket never waits longer than the maximum. */
const COLD_RUN_BOUNDS = { min: 3, max: 25 } as const;

/**
 * Consecutive origin-served responses that put a bucket back on its configured
 * limit at once, without waiting for the window's average to follow.
 *
 * A working set going cold shows up as an unbroken run of misses well before
 * the average moves, and the misses lead the first 429. But a run is only
 * evidence of that if the measured traffic would not produce one on its own: at
 * a half-cached workload runs of ten arrive on their own often enough to cost
 * real throughput, while a workload the cache serves almost entirely should be
 * believed after three or four. So the threshold is derived from the miss share
 * rather than fixed — a run long enough to be surprising at the rate misses are
 * actually arriving.
 *
 * A single hit lifts the clamp again, and the window is kept, so a brief cold
 * patch costs the climb back and not the measurement.
 */
function coldRunLengthFor(missShare: number): number {
  if (missShare <= 0 || missShare >= 1) {
    return COLD_RUN_BOUNDS.min;
  }
  const surprising = Math.log(COLD_RUN_IMPROBABILITY) / Math.log(missShare);
  return Math.min(COLD_RUN_BOUNDS.max, Math.max(COLD_RUN_BOUNDS.min, Math.ceil(surprising)));
}

/**
 * How long a bucket may go unobserved before its cache measurement is discarded.
 *
 * A window carries no time of its own, so without this a bucket that ran hot,
 * went quiet for an hour and woke up would admit its whole raised ceiling at
 * once, on the strength of a measurement describing traffic that is long over
 * and against keys that may well have expired. Forgetting costs the client the
 * climb back — a window of responses at the configured limit — which is the
 * same price a cold start pays.
 */
const CACHE_WINDOW_MAX_IDLE_MS = 60_000;

/**
 * How far above its configured limit a bucket may be paced, however cached its
 * traffic looks.
 *
 * When a working set goes cold, everything already admitted is in flight before
 * the first response can report it, so the requests that overshoot the origin
 * are roughly the ceiling times one round trip — a cost no feedback can react
 * its way out of. Bounding the multiple bounds that burst for every tier at
 * once, and costs little: the measured gain flattens well before the ceiling
 * runs out of room.
 */
const MAX_CEILING_MULTIPLE = 8;

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
  /**
   * Raises a bucket's ceiling in proportion to the share of its responses the
   * cache serves. Omitted, the ceiling never passes the configured limit.
   *
   * Ignored when `adaptive` is `false`, which pins every bucket outright.
   */
  cacheAware?: CacheAwareConfig;
  /**
   * Called whenever a response changes how a bucket is being paced, so a
   * caller can see the rate it is running at without inferring it from timings.
   *
   * It runs on the response path, so it should return quickly. A failure is
   * swallowed: observing the limiter must not turn a served request into an
   * error.
   */
  onRateLimitChange?: (status: RateLimitStatus) => void;
}

interface Bucket {
  throttle: Throttle;
  /** Rate the client asked for. */
  configuredLimit: number;
  /** Most recent quota a response advertised, if any. */
  serverLimit?: number;
  lastDecreaseAt: number;
  lastIncreaseAt: number;
  /** Ring buffer of the last `CACHE_SAMPLE_WINDOW` cache observations. */
  cacheSamples: boolean[];
  cacheSampleCursor: number;
  cacheHitCount: number;
  /** Origin-served responses since the last cache hit. */
  consecutiveMisses: number;
  /** When the window last took a sample, for ageing it out while the bucket is idle. */
  lastCacheObservationAt: number;
  /** Pacing last reported to `onRateLimitChange`, so unchanged pacing is not reported twice. */
  reportedStatus?: Omit<RateLimitStatus, "bucket">;
}

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
 * is. It never drops below the configured floor, and never rises above
 * `context.limit` unless `cacheAware` is configured and a cache is observably
 * absorbing the bucket's traffic, in which case it may recover to a multiple of
 * it.
 */
export function createDefaultRateLimiter(options: DefaultRateLimiterOptions = {}): RateLimiter {
  const { adaptive = true, parseServerLimit, onRateLimitChange } = options;
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
    minRequestsPerSecond: clampRequestsPerSecond(
      configured.minRequestsPerSecond ?? MIN_REQUESTS_PER_SECOND,
    ),
  };

  const stepFor = (ceiling: number) =>
    adaptiveConfig.increaseStep ?? Math.max(1, Math.round(ceiling / RECOVERY_INTERVALS));
  const adaptationEnabled = adaptive !== false;
  // `adaptive: false` means "pin every bucket to its base limit", so a
  // discovered ceiling has no business overriding it.
  const cacheAware = adaptationEnabled ? options.cacheAware : undefined;
  const buckets = new Map<string, Bucket>();

  /** Share of the bucket's observed responses the cache served, if it has any. */
  const hitShareOf = (bucket: Bucket): number | undefined =>
    cacheAware && bucket.cacheSamples.length > 0
      ? bucket.cacheHitCount / bucket.cacheSamples.length
      : undefined;

  /**
   * Ceiling the effective limit recovers towards; never exceeded.
   *
   * Only the share of requests that misses the cache reaches the origin, so a
   * bucket whose responses are `hitShare` cached can run at
   * `configuredLimit / (1 - hitShare)` and still put no more than
   * `configuredLimit` requests per second on the origin. With no observations,
   * or none of them hits, this is the configured limit exactly.
   */
  const ceilingOf = (bucket: Bucket): number => {
    let ceiling = bucket.configuredLimit;
    const hitShare = hitShareOf(bucket);

    if (cacheAware && hitShare !== undefined && bucket.cacheSamples.length >= CACHE_SAMPLE_WINDOW) {
      const missShare = 1 - hitShare;
      // Never below the configured limit: the headroom is what cache hits add,
      // and a caller misconfiguring the cached rate must not end up paced
      // slower than the origin quota it asked for, or — at zero — not paced at
      // all.
      const headroom = clampRequestsPerSecond(
        Math.min(cacheAware.cachedRequestsPerSecond, bucket.configuredLimit * MAX_CEILING_MULTIPLE),
        bucket.configuredLimit,
      );
      if (bucket.consecutiveMisses < coldRunLengthFor(missShare)) {
        ceiling =
          missShare <= 0
            ? headroom
            : Math.min(headroom, Math.floor(bucket.configuredLimit / missShare));
      }
    }

    // A quota the API advertises wins over a discovered one, including over the
    // configured limit. Today the Content API advertises no per-second quota,
    // so this never binds; were it to start advertising one, it would cap the
    // discovered ceiling and the mechanism would go quiet rather than overrun
    // a rate the API just named.
    return Math.min(ceiling, bucket.serverLimit ?? Number.POSITIVE_INFINITY);
  };

  /**
   * Discards a cache measurement the bucket has stopped renewing, so a raised
   * ceiling cannot outlive the traffic that justified it.
   */
  const forgetIdleCacheWindow = (bucket: Bucket, now: number) => {
    if (
      bucket.cacheSamples.length === 0 ||
      now - bucket.lastCacheObservationAt < CACHE_WINDOW_MAX_IDLE_MS
    ) {
      return;
    }

    bucket.cacheSamples = [];
    bucket.cacheSampleCursor = 0;
    bucket.cacheHitCount = 0;
    bucket.consecutiveMisses = 0;
  };

  /** Brings a limit back under a ceiling that has just fallen. */
  const clampToCeiling = (bucket: Bucket) => {
    const ceiling = ceilingOf(bucket);
    if (bucket.throttle.getLimit() > ceiling) {
      bucket.throttle.setLimit(ceiling);
    }
  };

  const observeCacheStatus = (bucket: Bucket, response: Response, now: number) => {
    const hit = cacheAware?.detectCacheHit(response);
    if (hit === undefined) {
      return;
    }

    bucket.lastCacheObservationAt = now;

    if (bucket.cacheSamples.length < CACHE_SAMPLE_WINDOW) {
      bucket.cacheSamples.push(hit);
    } else {
      if (bucket.cacheSamples[bucket.cacheSampleCursor]) {
        bucket.cacheHitCount--;
      }
      bucket.cacheSamples[bucket.cacheSampleCursor] = hit;
      bucket.cacheSampleCursor = (bucket.cacheSampleCursor + 1) % CACHE_SAMPLE_WINDOW;
    }

    if (hit) {
      bucket.cacheHitCount++;
    }
    bucket.consecutiveMisses = hit ? 0 : bucket.consecutiveMisses + 1;
  };

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
      cacheSamples: [],
      cacheSampleCursor: 0,
      cacheHitCount: 0,
      consecutiveMisses: 0,
      lastCacheObservationAt: Number.NEGATIVE_INFINITY,
    };
    buckets.set(context.bucket, bucket);
    return bucket;
  };

  const reportStatus = (bucket: Bucket, context: RateLimitContext) => {
    if (!onRateLimitChange) {
      return;
    }

    const status: Omit<RateLimitStatus, "bucket"> = {
      requestsPerSecond: bucket.throttle.getLimit(),
      ceiling: ceilingOf(bucket),
      configuredLimit: bucket.configuredLimit,
      cacheHitShare: hitShareOf(bucket),
    };
    const previous = bucket.reportedStatus;
    if (
      previous &&
      previous.requestsPerSecond === status.requestsPerSecond &&
      previous.ceiling === status.ceiling &&
      previous.configuredLimit === status.configuredLimit &&
      previous.cacheHitShare === status.cacheHitShare
    ) {
      return;
    }

    bucket.reportedStatus = status;
    try {
      onRateLimitChange({ bucket: context.bucket, ...status });
    } catch {
      // Observing the limiter must never turn a served request into an error.
    }
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
    bucket.serverLimit = clampRequestsPerSecond(serverLimit, adaptiveConfig.minRequestsPerSecond);
    if (!adaptationEnabled) {
      bucket.throttle.setLimit(ceilingOf(bucket));
      return;
    }
    clampToCeiling(bucket);
  };

  return {
    acquire: (context) => {
      const bucket = getBucket(context);
      if (cacheAware) {
        // A bucket admits before it can be told anything, so a measurement that
        // has gone stale has to be dropped on the way in rather than on the
        // next response — by then the whole raised rate is already on the wire.
        forgetIdleCacheWindow(bucket, Date.now());
        clampToCeiling(bucket);
      }
      return bucket.throttle.acquire();
    },
    recordResponse: (context, response) => {
      const bucket = getBucket(context);
      applyServerLimit(bucket, response);

      if (!adaptationEnabled) {
        reportStatus(bucket, context);
        return;
      }

      const now = Date.now();
      forgetIdleCacheWindow(bucket, now);
      observeCacheStatus(bucket, response, now);
      // A ceiling that just fell — traffic turning cold — takes effect at once,
      // rather than waiting for a 429 to bring the limit back down.
      clampToCeiling(bucket);

      if (response.status === THROTTLED_STATUS) {
        decrease(bucket, now);
      } else {
        // Any answer that is not a refusal counts as the quota holding, a 404
        // among them: recovering only on 2xx would strand a client whose
        // workload legitimately produces other statuses.
        increase(bucket, now);
      }
      reportStatus(bucket, context);
    },
  };
}

/** A limiter that admits every request immediately. */
export function createPassthroughRateLimiter(): RateLimiter {
  return { acquire: () => Promise.resolve() };
}

// This file is duplicated verbatim in @storyblok/api-client and
// @storyblok/management-api-client. The two copies must stay identical; apply
// any change to both.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultRateLimiter,
  createPassthroughRateLimiter,
  type RateLimitContext,
  type RateLimiter,
  type RateLimitStatus,
} from "./limiter";

const context = (overrides: Partial<RateLimitContext> = {}): RateLimitContext => ({
  path: "/v2/cdn/stories",
  query: {},
  bucket: "default",
  limit: 4,
  ...overrides,
});

const ok = () => new Response(null, { status: 200 });
const throttled = () => new Response(null, { status: 429 });

/**
 * Starts `count` requests and returns how many of them the limiter admitted
 * without advancing time — i.e. the rate currently in effect.
 */
async function admittedImmediately(limiter: RateLimiter, ctx: RateLimitContext, count: number) {
  let admitted = 0;
  for (let i = 0; i < count; i++) {
    void limiter.acquire(ctx).then(() => {
      admitted++;
    });
  }
  await vi.advanceTimersByTimeAsync(0);
  return admitted;
}

/** Lets every pending window drain so the next measurement starts clean. */
async function settle(ms = 10_000) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe("createDefaultRateLimiter()", () => {
  afterEach(() => vi.useRealTimers());

  it("should admit at most `context.limit` requests per second", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();

    expect(await admittedImmediately(limiter, context({ limit: 3 }), 7)).toBe(3);
  });

  it("should pace each bucket independently", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const small = context({ bucket: "small", limit: 2 });
    const large = context({ bucket: "large", limit: 5 });

    expect(await admittedImmediately(limiter, small, 6)).toBe(2);
    expect(await admittedImmediately(limiter, large, 6)).toBe(5);
  });

  it("should halve the rate after the API throttles a request", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(8);
    await settle();

    await limiter.recordResponse?.(ctx, throttled());

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
  });

  it("should treat a burst of throttled responses as one event", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });
    await settle();

    // Five refusals from one overrun window describe a single overload, not
    // five — collapsing once per response would drop straight to the floor.
    for (let i = 0; i < 5; i++) {
      await limiter.recordResponse?.(ctx, throttled());
    }

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
  });

  it("should decrease again once the cooldown has passed", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle(1000);
    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(2);
  });

  it("should recover additively while nothing is throttled", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();
    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
    await settle();

    await limiter.recordResponse?.(ctx, ok());
    await settle();
    expect(await admittedImmediately(limiter, ctx, 20)).toBe(5);
  });

  it("should never recover past the limit the client asked for", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 3 });

    for (let i = 0; i < 20; i++) {
      await limiter.recordResponse?.(ctx, ok());
      await settle(1000);
    }

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(3);
  });

  it("should not drop below the configured floor", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ adaptive: { minRequestsPerSecond: 2 } });
    const ctx = context({ limit: 16 });

    for (let i = 0; i < 10; i++) {
      await limiter.recordResponse?.(ctx, throttled());
      await settle(1000);
    }

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(2);
  });

  it("should hold the rate steady when adaptation is disabled", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ adaptive: false });
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(8);
  });

  it("should lower the ceiling to the quota a response advertises", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ parseServerLimit: () => 2 });
    const ctx = context({ limit: 10 });

    await limiter.recordResponse?.(ctx, ok());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(2);
  });

  it.each([
    { label: "zero", quota: 0 },
    { label: "not a number", quota: Number.NaN },
  ])("should hold the floor when the advertised quota is $label", async ({ quota }) => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ parseServerLimit: () => quota });
    const ctx = context({ limit: 10 });

    await limiter.recordResponse?.(ctx, ok());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(1);
  });

  it("should keep backing off when the cache detector throws", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: {
        detectCacheHit: () => {
          throw new Error("unreadable header");
        },
        cachedRequestsPerSecond: 1000,
      },
    });
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
  });

  it("should keep backing off when the quota parser throws", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      parseServerLimit: () => {
        throw new Error("unreadable header");
      },
    });
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
  });

  it("should not admit past the limit when `increaseStep` is not a number", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      adaptive: { increaseStep: Number.NaN, decreaseCooldownMs: 0, recoveryIntervalMs: 0 },
    });
    const ctx = context({ limit: 4 });

    await limiter.recordResponse?.(ctx, throttled());
    await limiter.recordResponse?.(ctx, ok());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBeLessThanOrEqual(4);
  });

  it("should keep the advertised quota as the ceiling recovery cannot exceed", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ parseServerLimit: () => 4 });
    const ctx = context({ limit: 50 });

    await limiter.recordResponse?.(ctx, ok());
    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(2);

    for (let i = 0; i < 20; i++) {
      await limiter.recordResponse?.(ctx, ok());
      await settle(1000);
    }

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
  });
});

describe("createDefaultRateLimiter() tuning guards", () => {
  afterEach(() => vi.useRealTimers());

  it("should keep pacing when the floor is configured below one request", async () => {
    vi.useFakeTimers();
    // Zero reads as "no limit" to the underlying window, so an unguarded floor
    // would turn sustained back-off into no pacing at all.
    const limiter = createDefaultRateLimiter({
      adaptive: { minRequestsPerSecond: 0, decreaseCooldownMs: 1 },
    });
    const ctx = context({ limit: 16 });

    for (let i = 0; i < 10; i++) {
      await limiter.recordResponse?.(ctx, throttled());
      await settle(1000);
    }

    expect(await admittedImmediately(limiter, ctx, 500)).toBe(1);
  });

  it("should not let a back-off factor above one raise the rate", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ adaptive: { decreaseFactor: 2 } });
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 100)).toBe(4);
  });

  it("should not let a floor above the client's rate raise it", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ adaptive: { minRequestsPerSecond: 200 } });
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 100)).toBe(8);
  });
});

describe("createDefaultRateLimiter() server quota", () => {
  afterEach(() => vi.useRealTimers());

  it("should follow the quota up again when a later response raises it", async () => {
    vi.useFakeTimers();
    let quota = 2;
    const limiter = createDefaultRateLimiter({
      adaptive: false,
      parseServerLimit: () => quota,
    });
    const ctx = context({ limit: 10 });

    await limiter.recordResponse?.(ctx, ok());
    await settle();
    expect(await admittedImmediately(limiter, ctx, 50)).toBe(2);
    await settle();

    // A transient low quota must not pin the client for the rest of its life.
    quota = 10;
    await limiter.recordResponse?.(ctx, ok());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 50)).toBe(10);
  });
});

describe("createDefaultRateLimiter() recovery", () => {
  afterEach(() => vi.useRealTimers());

  it("should recover a large bucket in the same time as a small one", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ bucket: "large", limit: 50 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();
    expect(await admittedImmediately(limiter, ctx, 100)).toBe(25);
    await settle();

    // A fixed step would take 25 intervals to undo one halving of a 50/s
    // bucket, and one interval to undo it on a 2/s bucket.
    await limiter.recordResponse?.(ctx, ok());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 100)).toBe(27);
  });

  it("should recover on answers that are not refusals, a 404 among them", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();
    expect(await admittedImmediately(limiter, ctx, 50)).toBe(4);
    await settle();

    await limiter.recordResponse?.(ctx, new Response(null, { status: 404 }));
    await settle();

    expect(await admittedImmediately(limiter, ctx, 50)).toBe(5);
  });

  it("should not back off on a server error, which is not a quota refusal", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, new Response(null, { status: 503 }));
    await settle();

    expect(await admittedImmediately(limiter, ctx, 50)).toBe(8);
  });
});

describe("createPassthroughRateLimiter()", () => {
  afterEach(() => vi.useRealTimers());

  it("should admit every request immediately", async () => {
    vi.useFakeTimers();

    expect(await admittedImmediately(createPassthroughRateLimiter(), context(), 500)).toBe(500);
  });
});

describe("createDefaultRateLimiter({ cacheAware })", () => {
  afterEach(() => vi.useRealTimers());

  const cached = () => new Response(null, { status: 200, headers: { "x-cache": "hit" } });
  const fromOrigin = () => new Response(null, { status: 200, headers: { "x-cache": "miss" } });
  /** A runtime that cannot read the cache status sees a response like this. */
  const unknownOrigin = () => new Response(null, { status: 200 });

  const cacheAware = {
    cachedRequestsPerSecond: 1000,
    detectCacheHit: (response: Response) => {
      const status = response.headers.get("x-cache");
      return status === null ? undefined : status === "hit";
    },
  };

  /** Reports responses one per second, letting the limit recover between them. */
  async function reportOverTime(
    limiter: RateLimiter,
    ctx: RateLimitContext,
    response: () => Response,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      await limiter.recordResponse?.(ctx, response());
      await vi.advanceTimersByTimeAsync(1000);
    }
  }

  it("should keep the bucket at its limit while responses come from the origin", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, fromOrigin, 80);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
  });

  it("should keep the bucket at its limit when responses carry no cache status", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, unknownOrigin, 80);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
  });

  it("should keep the bucket at its limit when nothing describes the cache", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 80);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
  });

  it("should let the bucket climb past its limit once the cache serves its responses", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(80);
  });

  it("should not climb more than eight times its limit however cached it looks", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 4 });

    await reportOverTime(limiter, ctx, cached, 120);

    // Well short of the 1000/s the cache itself would serve. What has to be
    // bounded is the requests already in flight when a working set goes cold.
    expect(await admittedImmediately(limiter, ctx, 200)).toBe(32);
  });

  it("should stop the climb at the rate the cache serves", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: { ...cacheAware, cachedRequestsPerSecond: 40 },
    });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(40);
  });

  it("should hold the origin-bound share of the traffic to the bucket's limit", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 10 });

    // Half the responses reach the origin, so twice the limit still puts only
    // the limit on the origin.
    let n = 0;
    await reportOverTime(limiter, ctx, () => (n++ % 2 === 0 ? cached() : fromOrigin()), 120);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(20);
  });

  it("should drop to its limit on a run of origin-served responses", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);
    expect(await admittedImmediately(limiter, ctx, 200)).toBe(80);
    await settle();

    // A fifth of the window, reported back to back. Waiting for the average to
    // follow would leave the bucket paced far above what the origin serves.
    for (let i = 0; i < 10; i++) {
      await limiter.recordResponse?.(ctx, fromOrigin());
    }

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
  });

  it("should climb again once the cache serves the bucket a hit", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);
    for (let i = 0; i < 10; i++) {
      await limiter.recordResponse?.(ctx, fromOrigin());
    }
    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
    await settle();

    // The run is broken and the window it measured is still there, so a brief
    // cold patch costs the climb back and not the measurement.
    await reportOverTime(limiter, ctx, cached, 30);

    expect(await admittedImmediately(limiter, ctx, 200)).toBeGreaterThan(10);
  });

  it("should return to the bucket's limit as soon as the traffic stops being cached", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ cacheAware });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);
    expect(await admittedImmediately(limiter, ctx, 200)).toBe(80);
    await settle();

    for (let i = 0; i < 50; i++) {
      await limiter.recordResponse?.(ctx, fromOrigin());
    }

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
  });

  it("should still halve the rate when a cached workload is throttled", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: { ...cacheAware, cachedRequestsPerSecond: 40 },
    });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);
    expect(await admittedImmediately(limiter, ctx, 200)).toBe(40);
    await settle();

    await limiter.recordResponse?.(ctx, throttled());

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(20);
  });

  it("should pin the bucket to its limit when adaptation is off", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ adaptive: false, cacheAware });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
  });

  it("should not climb past a quota the API advertises", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware,
      parseServerLimit: () => 12,
    });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(12);
  });
});

describe("createDefaultRateLimiter({ cacheAware }) — bounds and decay", () => {
  afterEach(() => vi.useRealTimers());

  const cached = () => new Response(null, { status: 200, headers: { "x-cache": "hit" } });
  const fromOrigin = () => new Response(null, { status: 200, headers: { "x-cache": "miss" } });

  const detectCacheHit = (response: Response) => {
    const status = response.headers.get("x-cache");
    return status === null ? undefined : status === "hit";
  };

  async function reportOverTime(
    limiter: RateLimiter,
    ctx: RateLimitContext,
    response: () => Response,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      await limiter.recordResponse?.(ctx, response());
      await vi.advanceTimersByTimeAsync(1000);
    }
  }

  it.each([
    ["zero", 0],
    ["not a number", Number.NaN],
    ["below the bucket's own limit", 3],
  ])("should still pace the bucket when the cached rate is %s", async (_name, cachedRate) => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: { cachedRequestsPerSecond: cachedRate, detectCacheHit },
    });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);

    // A cached rate the caller got wrong may cost the headroom, but it must
    // never leave the bucket unpaced, nor paced slower than the limit it asked
    // for.
    expect(await admittedImmediately(limiter, ctx, 500)).toBe(10);
  });

  it("should forget a cache measurement the bucket has stopped renewing", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: { cachedRequestsPerSecond: 1000, detectCacheHit },
    });
    const ctx = context({ limit: 6 });

    await reportOverTime(limiter, ctx, cached, 120);
    expect(await admittedImmediately(limiter, ctx, 200)).toBe(48);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    // The entries that measurement described are long gone, so waking up must
    // not put the whole raised rate on the wire before a single response can
    // say otherwise.
    expect(await admittedImmediately(limiter, ctx, 200)).toBe(6);
  });

  it("should keep a raised rate across a pause short enough for the measurement to hold", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: { cachedRequestsPerSecond: 1000, detectCacheHit },
    });
    const ctx = context({ limit: 6 });

    await reportOverTime(limiter, ctx, cached, 120);
    await vi.advanceTimersByTimeAsync(5000);

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(48);
  });

  it("should drop a fully cached bucket on a run of misses far shorter than the window", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: { cachedRequestsPerSecond: 1000, detectCacheHit },
    });
    const ctx = context({ limit: 10 });

    await reportOverTime(limiter, ctx, cached, 120);
    await settle();

    // Nothing else was missing, so a handful of misses in a row is already the
    // traffic going cold rather than the workload's ordinary variation.
    for (let i = 0; i < 5; i++) {
      await limiter.recordResponse?.(ctx, fromOrigin());
    }

    expect(await admittedImmediately(limiter, ctx, 200)).toBe(10);
  });

  it("should not read a run of misses as going cold when the bucket misses that often anyway", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      cacheAware: { cachedRequestsPerSecond: 1000, detectCacheHit },
    });
    const ctx = context({ limit: 10 });

    // Half the responses reach the origin, so runs of misses arrive on their
    // own. Reading one as a cold transition would cost this workload its
    // headroom over and over.
    let n = 0;
    await reportOverTime(limiter, ctx, () => (n++ % 2 === 0 ? cached() : fromOrigin()), 120);
    await settle();

    for (let i = 0; i < 10; i++) {
      await limiter.recordResponse?.(ctx, fromOrigin());
    }

    expect(await admittedImmediately(limiter, ctx, 200)).toBeGreaterThan(10);
  });
});

/** The most recent status an observer was handed. */
function latest<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

describe("createDefaultRateLimiter({ onRateLimitChange })", () => {
  afterEach(() => vi.useRealTimers());

  const cached = () => new Response(null, { status: 200, headers: { "x-cache": "hit" } });
  const cacheAware = {
    cachedRequestsPerSecond: 1000,
    detectCacheHit: (response: Response) => {
      const status = response.headers.get("x-cache");
      return status === null ? undefined : status === "hit";
    },
  };

  it("should report the rate a bucket has backed off to", async () => {
    vi.useFakeTimers();
    const reported: RateLimitStatus[] = [];
    const limiter = createDefaultRateLimiter({ onRateLimitChange: (s) => reported.push(s) });
    const ctx = context({ bucket: "listings", limit: 10 });

    await limiter.recordResponse?.(ctx, throttled());

    expect(latest(reported)).toMatchObject({
      bucket: "listings",
      requestsPerSecond: 5,
      ceiling: 10,
      configuredLimit: 10,
    });
  });

  it("should report the ceiling the cache measurement has opened up", async () => {
    vi.useFakeTimers();
    const reported: RateLimitStatus[] = [];
    const limiter = createDefaultRateLimiter({
      cacheAware,
      onRateLimitChange: (s) => reported.push(s),
    });
    const ctx = context({ limit: 6 });

    for (let i = 0; i < 60; i++) {
      await limiter.recordResponse?.(ctx, cached());
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(latest(reported)).toMatchObject({ ceiling: 48, cacheHitShare: 1, configuredLimit: 6 });
  });

  it("should not open the ceiling up before the measurement covers a full window", async () => {
    vi.useFakeTimers();
    const reported: RateLimitStatus[] = [];
    const limiter = createDefaultRateLimiter({
      cacheAware,
      onRateLimitChange: (s) => reported.push(s),
    });
    const ctx = context({ limit: 6 });

    for (let i = 0; i < 49; i++) {
      await limiter.recordResponse?.(ctx, cached());
      await vi.advanceTimersByTimeAsync(1000);
    }
    // Every response so far has been a hit, so only the sample count is holding
    // the ceiling down — a client must not extrapolate from a lucky handful.
    expect(latest(reported)?.ceiling).toBe(6);

    await limiter.recordResponse?.(ctx, cached());

    expect(latest(reported)?.ceiling).toBe(48);
  });

  it("should keep serving requests when the observer throws", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({
      onRateLimitChange: () => {
        throw new Error("observer exploded");
      },
    });
    const ctx = context({ limit: 4 });

    expect(() => limiter.recordResponse?.(ctx, ok())).not.toThrow();
    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
  });
});

// This file is duplicated verbatim in @storyblok/api-client and
// @storyblok/management-api-client. The two copies must stay identical; apply
// any change to both.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultRateLimiter,
  createPassthroughRateLimiter,
  type RateLimitContext,
  type RateLimiter,
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

  it("admits at most `context.limit` requests per second", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();

    expect(await admittedImmediately(limiter, context({ limit: 3 }), 7)).toBe(3);
  });

  it("paces each bucket independently", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const small = context({ bucket: "small", limit: 2 });
    const large = context({ bucket: "large", limit: 5 });

    expect(await admittedImmediately(limiter, small, 6)).toBe(2);
    expect(await admittedImmediately(limiter, large, 6)).toBe(5);
  });

  it("halves the rate after the API throttles a request", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(8);
    await settle();

    await limiter.recordResponse?.(ctx, throttled());

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(4);
  });

  it("treats a burst of throttled responses as one event", async () => {
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

  it("decreases again once the cooldown has passed", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle(1000);
    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(2);
  });

  it("recovers additively while nothing is throttled", async () => {
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

  it("never recovers past the limit the client asked for", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter();
    const ctx = context({ limit: 3 });

    for (let i = 0; i < 20; i++) {
      await limiter.recordResponse?.(ctx, ok());
      await settle(1000);
    }

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(3);
  });

  it("does not drop below the configured floor", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ adaptive: { minRequestsPerSecond: 2 } });
    const ctx = context({ limit: 16 });

    for (let i = 0; i < 10; i++) {
      await limiter.recordResponse?.(ctx, throttled());
      await settle(1000);
    }

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(2);
  });

  it("holds the rate steady when adaptation is disabled", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ adaptive: false });
    const ctx = context({ limit: 8 });

    await limiter.recordResponse?.(ctx, throttled());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(8);
  });

  it("lowers the ceiling to the quota a response advertises", async () => {
    vi.useFakeTimers();
    const limiter = createDefaultRateLimiter({ parseServerLimit: () => 2 });
    const ctx = context({ limit: 10 });

    await limiter.recordResponse?.(ctx, ok());
    await settle();

    expect(await admittedImmediately(limiter, ctx, 20)).toBe(2);
  });

  it("keeps the advertised quota as the ceiling recovery cannot exceed", async () => {
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

  it("admits every request immediately", async () => {
    vi.useFakeTimers();

    expect(await admittedImmediately(createPassthroughRateLimiter(), context(), 500)).toBe(500);
  });
});

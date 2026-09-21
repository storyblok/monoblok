import { afterEach, describe, expect, it, vi } from "vitest";
import { createThrottleManager, determineTier, parseRateLimitPolicyHeader } from "./rate-limit";
import type { RateLimitContext, RateLimiter } from "./limiter";

/**
 * Feeds a response carrying a rate-limit policy header through the manager's
 * `fetch` wrapper — the path by which the limiter sees responses.
 */
async function recordPolicyHeader(
  manager: ReturnType<typeof createThrottleManager>,
  path: string,
  policy: string,
) {
  const fetchWithPolicy = manager.wrapFetch(
    async () => new Response(null, { headers: { "x-ratelimit-policy": policy } }),
  );
  await fetchWithPolicy(`https://api.storyblok.com${path}`);
}

describe("determineTier()", () => {
  it("should return SINGLE_OR_SMALL for a single story path", () => {
    expect(determineTier("/v2/cdn/stories/my-story", {})).toBe("SINGLE_OR_SMALL");
    // Nested slugs — per_page > 25 is supplied to confirm it's the regex, not the per_page default.
    expect(determineTier("/v2/cdn/stories/folder/nested-story", { per_page: 100 })).toBe(
      "SINGLE_OR_SMALL",
    );
  });

  it("should return SINGLE_OR_SMALL when per_page is absent (default 25)", () => {
    expect(determineTier("/v2/cdn/stories", {})).toBe("SINGLE_OR_SMALL");
  });

  it("should return SINGLE_OR_SMALL for per_page ≤ 25", () => {
    expect(determineTier("/v2/cdn/stories", { per_page: 1 })).toBe("SINGLE_OR_SMALL");
    expect(determineTier("/v2/cdn/stories", { per_page: 25 })).toBe("SINGLE_OR_SMALL");
  });

  it("should return MEDIUM for per_page 26–50", () => {
    expect(determineTier("/v2/cdn/stories", { per_page: 26 })).toBe("MEDIUM");
    expect(determineTier("/v2/cdn/stories", { per_page: 50 })).toBe("MEDIUM");
  });

  it("should return LARGE for per_page 51–75", () => {
    expect(determineTier("/v2/cdn/stories", { per_page: 51 })).toBe("LARGE");
    expect(determineTier("/v2/cdn/stories", { per_page: 75 })).toBe("LARGE");
  });

  it("should return VERY_LARGE for per_page > 75", () => {
    expect(determineTier("/v2/cdn/stories", { per_page: 76 })).toBe("VERY_LARGE");
    expect(determineTier("/v2/cdn/stories", { per_page: 100 })).toBe("VERY_LARGE");
  });

  it("should parse per_page when provided as a string", () => {
    expect(determineTier("/v2/cdn/stories", { per_page: "26" })).toBe("MEDIUM");
  });

  it("should fall back to SINGLE_OR_SMALL for an unparseable per_page string", () => {
    expect(determineTier("/v2/cdn/stories", { per_page: "invalid" })).toBe("SINGLE_OR_SMALL");
  });

  it("should not treat /v2/cdn/stories (no trailing identifier) as single story", () => {
    expect(determineTier("/v2/cdn/stories", {})).toBe("SINGLE_OR_SMALL");
    // Still SINGLE_OR_SMALL here because per_page defaults to 25, but it's
    // because of per_page, not single-story detection.
    expect(determineTier("/v2/cdn/stories", { per_page: 50 })).toBe("MEDIUM");
  });

  it("should work for non-story paths (links, tags, etc.)", () => {
    expect(determineTier("/v2/cdn/links", { per_page: 100 })).toBe("VERY_LARGE");
    expect(determineTier("/v2/cdn/tags", {})).toBe("SINGLE_OR_SMALL");
  });
});

describe("parseRateLimitPolicyHeader()", () => {
  const makeResponse = (headerValue: string | null) =>
    new Response(null, {
      headers: headerValue ? { "x-ratelimit-policy": headerValue } : {},
    });

  it("should ignore concurrent-requests policies", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"concurrent-requests";q=30'))).toBeUndefined();
  });

  it("should parse the q= value from a rate-limit policy", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";q=50'))).toBe(50);
  });

  it("should return undefined when the header is absent", () => {
    expect(parseRateLimitPolicyHeader(makeResponse(null))).toBeUndefined();
  });

  it("should return undefined when the header has no q= value", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";r=5'))).toBeUndefined();
  });

  it("should cap the parsed value at 1000", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";q=9999'))).toBe(1000);
  });
});

describe("createThrottleManager(false)", () => {
  it("should execute the function immediately without queuing", async () => {
    const manager = createThrottleManager(false);
    const fn = vi.fn().mockResolvedValue("result");
    const result = await manager.execute("/v2/cdn/stories", {}, fn);
    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("should treat adaptToResponse as a no-op", () => {
    const manager = createThrottleManager(false);
    expect(() => manager.adaptToResponse(undefined)).not.toThrow();
  });
});

describe("createThrottleManager(number)", () => {
  afterEach(() => vi.useRealTimers());

  it("should rate-limit calls to the configured number per second", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(2);
    const fn = vi.fn(async () => "done");

    for (let i = 0; i < 5; i++) {
      manager.execute("/v2/cdn/stories", {}, fn);
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("should ignore concurrent-requests headers (not a rate limit)", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(50);
    await recordPolicyHeader(manager, "/v2/cdn/stories", '"concurrent-requests";q=5');

    const fn = vi.fn(async () => "done");
    for (let i = 0; i < 50; i++) {
      manager.execute("/v2/cdn/stories", {}, fn);
    }

    // The concurrent-requests header is ignored, so the full 50 req/s is available.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(50);
  });

  it("should adapt the limit from rate-limit server headers, respecting the user ceiling", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(50);
    await recordPolicyHeader(manager, "/v2/cdn/stories", '"rate-limit";q=5');

    const fn = vi.fn(async () => "done");
    for (let i = 0; i < 10; i++) {
      manager.execute("/v2/cdn/stories", {}, fn);
    }

    // Server said 5, user ceiling is 50, so the effective limit is min(50, 5) = 5.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(5);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(10);
  });

  it("should not exceed the user ceiling even if the server reports higher", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(3);
    await recordPolicyHeader(manager, "/v2/cdn/stories", '"rate-limit";q=100');

    const fn = vi.fn(async () => "done");
    for (let i = 0; i < 9; i++) {
      manager.execute("/v2/cdn/stories", {}, fn);
    }

    // Server said 100, user ceiling is 3, so the effective limit is min(3, 100) = 3.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(6);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(9);
  });
});

describe("createThrottleManager({ requestsPerSecond })", () => {
  afterEach(() => vi.useRealTimers());

  it("should rate-limit to requestsPerSecond", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 2 });
    const fn = vi.fn(async () => "done");

    for (let i = 0; i < 5; i++) {
      manager.execute("/v2/cdn/stories", {}, fn);
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("should honor the deprecated maxConcurrency alias", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ maxConcurrency: 2 });
    const fn = vi.fn(async () => "done");

    for (let i = 0; i < 5; i++) {
      manager.execute("/v2/cdn/stories", {}, fn);
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("should prefer requestsPerSecond over maxConcurrency when both are set", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 2, maxConcurrency: 50 });
    const fn = vi.fn(async () => "done");

    for (let i = 0; i < 5; i++) {
      manager.execute("/v2/cdn/stories", {}, fn);
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("createThrottleManager({})", () => {
  afterEach(() => vi.useRealTimers());

  it("should route single-story paths to the SINGLE_OR_SMALL tier (50 req/s)", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    const fn = vi.fn(async () => "done");

    // 50 calls fit in the first one-second window for this tier.
    for (let i = 0; i < 50; i++) {
      manager.execute("/v2/cdn/stories/my-story", {}, fn);
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(50);
  });

  it("should route large per_page to the VERY_LARGE tier (6 req/s)", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    const fn = vi.fn(async () => "done");

    for (let i = 0; i < 12; i++) {
      manager.execute("/v2/cdn/stories", { per_page: 100 }, fn);
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(6);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(12);
  });

  it("should ignore concurrent-requests headers in auto-detect mode", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    await recordPolicyHeader(manager, "/v2/cdn/stories/my-story", '"concurrent-requests";q=10');

    const fn = vi.fn(async () => "done");
    for (let i = 0; i < 50; i++) {
      manager.execute("/v2/cdn/stories/my-story", {}, fn);
    }

    // The concurrent-requests header is ignored, so the full SINGLE_OR_SMALL limit of 50 is available.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(50);
  });

  it("should adapt the SINGLE_OR_SMALL tier from rate-limit server headers", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    await recordPolicyHeader(manager, "/v2/cdn/stories/my-story", '"rate-limit";q=10');

    const fn = vi.fn(async () => "done");
    for (let i = 0; i < 20; i++) {
      manager.execute("/v2/cdn/stories/my-story", {}, fn);
    }

    // Default is 50, server said 10, so the effective limit is min(50, 10) = 10.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(10);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(20);
  });

  it("should ignore server headers when adaptToServerHeaders is false", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ adaptToServerHeaders: false });
    await recordPolicyHeader(manager, "/v2/cdn/stories/my-story", '"rate-limit";q=1');

    const fn = vi.fn(async () => "done");
    for (let i = 0; i < 50; i++) {
      manager.execute("/v2/cdn/stories/my-story", {}, fn);
    }

    // The header is ignored, so the default 50 req/s remains available.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(50);
  });

  it("should propagate errors from the wrapped function", async () => {
    const manager = createThrottleManager({});
    const error = new Error("boom");
    await expect(
      manager.execute("/v2/cdn/stories", {}, () => Promise.reject(error)),
    ).rejects.toThrow("boom");
  });

  it("should treat adaptToResponse as a no-op when response is undefined", () => {
    const manager = createThrottleManager({});
    expect(() => manager.adaptToResponse(undefined)).not.toThrow();
  });
});

describe("createThrottleManager({ limiter })", () => {
  afterEach(() => vi.useRealTimers());

  /** Records what the manager tells a custom limiter about each request. */
  const createRecordingLimiter = () => {
    const acquired: RateLimitContext[] = [];
    const released: RateLimitContext[] = [];
    const recorded: Array<{ context: RateLimitContext; status: number }> = [];

    return {
      acquired,
      released,
      recorded,
      limiter: {
        acquire: async (context) => {
          acquired.push(context);
        },
        release: (context) => {
          released.push(context);
        },
        recordResponse: (context, response) => {
          recorded.push({ context, status: response.status });
        },
      } satisfies RateLimiter,
    };
  };

  it("should ask the custom limiter for admission instead of throttling locally", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });
    const fn = vi.fn(async () => "done");

    // Far more than any built-in tier allows: a custom limiter owns the pacing.
    await Promise.all(
      Array.from({ length: 200 }, () => manager.execute("/v2/cdn/stories/my-story", {}, fn)),
    );

    expect(fn).toHaveBeenCalledTimes(200);
    expect(acquired).toHaveLength(200);
  });

  it("should tell the limiter which quota the request draws from and at what rate", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });

    await manager.execute("/v2/cdn/stories/my-story", {}, async () => "done");
    await manager.execute("/v2/cdn/stories", { per_page: 100 }, async () => "done");

    expect(acquired[0]).toMatchObject({ bucket: "SINGLE_OR_SMALL", limit: 50 });
    expect(acquired[1]).toMatchObject({ bucket: "VERY_LARGE", limit: 6 });
  });

  it("should report a single bucket and the configured rate in fixed-limit mode", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ requestsPerSecond: 7, limiter });

    await manager.execute("/v2/cdn/stories/my-story", {}, async () => "done");
    await manager.execute("/v2/cdn/stories", { per_page: 100 }, async () => "done");

    expect(acquired[0]).toMatchObject({ bucket: "fixed", limit: 7 });
    expect(acquired[1]).toMatchObject({ bucket: "fixed", limit: 7 });
  });

  it("should release the slot even when the request fails", async () => {
    const { limiter, released } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });

    await expect(
      manager.execute("/v2/cdn/stories", {}, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(released).toHaveLength(1);
  });

  it("should report every response, including the ones a retry replaced", async () => {
    const { limiter, recorded } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });
    const statuses = [429, 429, 200];
    let attempt = 0;
    const fetchWithRetries = manager.wrapFetch(
      async () => new Response(null, { status: statuses[attempt++] }),
    );

    for (const _ of statuses) {
      await fetchWithRetries("https://api.storyblok.com/v2/cdn/stories?per_page=100");
    }

    expect(recorded.map((entry) => entry.status)).toEqual(statuses);
  });

  it("should derive the quota of a recorded response from the request URL", async () => {
    const { limiter, recorded } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });
    const fetchOk = manager.wrapFetch(async () => new Response(null, { status: 200 }));

    await fetchOk("https://api.storyblok.com/v2/cdn/stories?per_page=100&token=abc");
    await fetchOk(new Request("https://api.storyblok.com/v2/cdn/stories/home?token=abc"));

    expect(recorded[0]?.context).toMatchObject({
      bucket: "VERY_LARGE",
      path: "/v2/cdn/stories",
    });
    expect(recorded[1]?.context).toMatchObject({
      bucket: "SINGLE_OR_SMALL",
      path: "/v2/cdn/stories/home",
    });
  });
});

describe("createThrottleManager({ adaptive })", () => {
  afterEach(() => vi.useRealTimers());

  /** Reports how many requests the manager starts without time advancing. */
  const startedImmediately = async (
    manager: ReturnType<typeof createThrottleManager>,
    path: string,
    count: number,
    query: Record<string, unknown> = {},
  ) => {
    const fn = vi.fn(async () => "done");
    for (let i = 0; i < count; i++) {
      void manager.execute(path, query, fn);
    }
    await vi.advanceTimersByTimeAsync(0);
    return fn.mock.calls.length;
  };

  it("should slow down after the API throttles a request", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 8 });
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    expect(await startedImmediately(manager, "/v2/cdn/stories", 20)).toBe(8);
    await vi.advanceTimersByTimeAsync(10_000);

    await fetchThrottled("https://api.storyblok.com/v2/cdn/stories");

    expect(await startedImmediately(manager, "/v2/cdn/stories", 20)).toBe(4);
  });

  it("should hold the configured rate when adaptation is off", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 8, adaptive: false });
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    await fetchThrottled("https://api.storyblok.com/v2/cdn/stories");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await startedImmediately(manager, "/v2/cdn/stories", 20)).toBe(8);
  });

  it("should slow down only the tier that was throttled", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    // A large listing is refused; small requests draw from a separate quota.
    await fetchThrottled("https://api.storyblok.com/v2/cdn/stories?per_page=100");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await startedImmediately(manager, "/v2/cdn/stories", 20, { per_page: 100 })).toBe(3);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await startedImmediately(manager, "/v2/cdn/stories/home", 60)).toBe(50);
  });
});

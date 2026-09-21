import { afterEach, describe, expect, it, vi } from "vitest";
import { createThrottleManager, determineTier, parseRateLimitPolicyHeader } from "./rate-limit";
import type { RateLimitContext, RateLimiter } from "./limiter";

const BASE = "https://api.storyblok.com";

/** Builds the URL the client would send for a path and query. */
function urlFor(path: string, query: Record<string, unknown> = {}) {
  const search = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
  search.set("token", "test-token");
  return `${BASE}${path}?${search.toString()}`;
}

/**
 * Sends requests through the manager's `fetch` wrapper, which is where
 * admission happens, and reports when each one was let through.
 */
function sendThrough(
  manager: ReturnType<typeof createThrottleManager>,
  count: number,
  path: string,
  query: Record<string, unknown> = {},
  status = 200,
) {
  const starts: number[] = [];
  const send = manager.wrapFetch(async () => {
    starts.push(Date.now());
    return new Response(null, { status });
  });
  const settled = Promise.all(Array.from({ length: count }, () => send(urlFor(path, query))));
  return { starts, settled };
}

/**
 * Reports how many requests the manager admits right now. The probe fails at
 * the transport, so it consumes slots without reporting a response — reading
 * the rate must not also move it.
 */
async function admittedNow(
  manager: ReturnType<typeof createThrottleManager>,
  count: number,
  path: string,
  query: Record<string, unknown> = {},
) {
  let started = 0;
  const send = manager.wrapFetch(() => {
    started++;
    return Promise.reject(new Error("probe"));
  });
  for (let i = 0; i < count; i++) {
    void send(urlFor(path, query)).catch(() => {});
  }
  await vi.advanceTimersByTimeAsync(0);
  return started;
}

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
  // That probe occupied a slot in the current window; let it age out so the
  // measurement that follows sees the whole limit.
  await vi.advanceTimersByTimeAsync(1000);
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

  it("should ignore a concurrent-requests policy whatever its name", () => {
    expect(
      parseRateLimitPolicyHeader(makeResponse('"space-concurrent-requests";q=30')),
    ).toBeUndefined();
    expect(
      parseRateLimitPolicyHeader(makeResponse('"space-concurrent-requests";w=60;q=30')),
    ).toBeUndefined();
    expect(parseRateLimitPolicyHeader(makeResponse('"concurrent-requests";q=30'))).toBeUndefined();
  });

  it("should read the rate as the quota over its window", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";q=50;w=1'))).toBe(50);
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";q=300;w=60'))).toBe(5);
  });

  it("should never read a rate below one request per second", () => {
    // Flooring to zero would read as "no limit" and remove pacing entirely.
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";q=1;w=60'))).toBe(1);
  });

  it("should ignore a quota stated without a window", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";q=50'))).toBeUndefined();
  });

  it("should take the rate from the policy that states one, whichever it is", () => {
    expect(
      parseRateLimitPolicyHeader(
        makeResponse('"space-concurrent-requests";q=30,"rate-limit";q=50;w=1'),
      ),
    ).toBe(50);
    expect(
      parseRateLimitPolicyHeader(
        makeResponse('"rate-limit";q=50;w=1,"space-concurrent-requests";q=30'),
      ),
    ).toBe(50);
  });

  it("should ignore an allowance stated over a window longer than a minute", () => {
    const daily = '"daily";q=100000;w=86400';

    expect(parseRateLimitPolicyHeader(makeResponse(daily))).toBeUndefined();
    expect(parseRateLimitPolicyHeader(makeResponse(`${daily},"per-second";q=50;w=1`))).toBe(50);
  });

  it("should take the strictest policy, whatever order they are listed in", () => {
    const strictLast = '"per-second";q=50;w=1,"burst";q=10;w=1';
    const strictFirst = '"burst";q=10;w=1,"per-second";q=50;w=1';

    expect(parseRateLimitPolicyHeader(makeResponse(strictLast))).toBe(10);
    expect(parseRateLimitPolicyHeader(makeResponse(strictFirst))).toBe(10);
  });

  it("should return undefined when the header is absent", () => {
    expect(parseRateLimitPolicyHeader(makeResponse(null))).toBeUndefined();
  });

  it("should return undefined when the header states no quota", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";r=5'))).toBeUndefined();
  });

  it("should cap the parsed value at 1000", () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"rate-limit";q=9999;w=1'))).toBe(1000);
  });
});

describe("createThrottleManager(false)", () => {
  it("should send every request immediately without queuing", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(false);

    const { starts } = sendThrough(manager, 200, "/v2/cdn/stories", { per_page: 100 });
    await vi.advanceTimersByTimeAsync(0);

    expect(starts).toHaveLength(200);
    vi.useRealTimers();
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
    const { starts } = sendThrough(manager, 5, "/v2/cdn/stories", {});

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(5);
  });

  it("should ignore concurrent-requests headers (not a rate limit)", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(50);
    await recordPolicyHeader(manager, "/v2/cdn/stories", '"space-concurrent-requests";q=5');

    const { starts } = sendThrough(manager, 50, "/v2/cdn/stories", {});

    // The concurrent-requests header is ignored, so the full 50 req/s is available.
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(50);
  });

  it("should adapt the limit from rate-limit server headers, respecting the user ceiling", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(50);
    await recordPolicyHeader(manager, "/v2/cdn/stories", '"rate-limit";q=5;w=1');

    const { starts } = sendThrough(manager, 10, "/v2/cdn/stories", {});

    // Server said 5, user ceiling is 50, so the effective limit is min(50, 5) = 5.
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(5);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(10);
  });

  it("should not exceed the user ceiling even if the server reports higher", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(3);
    await recordPolicyHeader(manager, "/v2/cdn/stories", '"rate-limit";q=100;w=1');

    const { starts } = sendThrough(manager, 9, "/v2/cdn/stories", {});

    // Server said 100, user ceiling is 3, so the effective limit is min(3, 100) = 3.
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(6);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(9);
  });
});

describe("createThrottleManager({ requestsPerSecond })", () => {
  afterEach(() => vi.useRealTimers());

  it("should rate-limit to requestsPerSecond", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 2 });
    const { starts } = sendThrough(manager, 5, "/v2/cdn/stories", {});

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(4);
  });

  it("should honor the deprecated maxConcurrency alias", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ maxConcurrency: 2 });
    const { starts } = sendThrough(manager, 5, "/v2/cdn/stories", {});

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(4);
  });

  it("should prefer requestsPerSecond over maxConcurrency when both are set", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 2, maxConcurrency: 50 });
    const { starts } = sendThrough(manager, 5, "/v2/cdn/stories", {});

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(2);
  });
});

describe("createThrottleManager({})", () => {
  afterEach(() => vi.useRealTimers());

  it("should route single-story paths to the SINGLE_OR_SMALL tier (50 req/s)", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    // 50 calls fit in the first one-second window for this tier.
    const { starts } = sendThrough(manager, 50, "/v2/cdn/stories/my-story", {});

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(50);
  });

  it("should route large per_page to the VERY_LARGE tier (6 req/s)", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    const { starts } = sendThrough(manager, 12, "/v2/cdn/stories", { per_page: 100 });

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(6);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(12);
  });

  it("should ignore concurrent-requests headers in auto-detect mode", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    await recordPolicyHeader(
      manager,
      "/v2/cdn/stories/my-story",
      '"space-concurrent-requests";q=10',
    );

    const { starts } = sendThrough(manager, 50, "/v2/cdn/stories/my-story", {});

    // The concurrent-requests header is ignored, so the full SINGLE_OR_SMALL limit of 50 is available.
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(50);
  });

  it("should adapt the SINGLE_OR_SMALL tier from rate-limit server headers", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});
    await recordPolicyHeader(manager, "/v2/cdn/stories/my-story", '"rate-limit";q=10;w=1');

    const { starts } = sendThrough(manager, 20, "/v2/cdn/stories/my-story", {});

    // Default is 50, server said 10, so the effective limit is min(50, 10) = 10.
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(10);

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts).toHaveLength(20);
  });

  it("should ignore server headers when adaptToServerHeaders is false", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ adaptToServerHeaders: false });
    await recordPolicyHeader(manager, "/v2/cdn/stories/my-story", '"rate-limit";q=1;w=1');

    const { starts } = sendThrough(manager, 50, "/v2/cdn/stories/my-story", {});

    // The header is ignored, so the default 50 req/s remains available.
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(50);
  });

  it("should propagate a transport failure to the caller", async () => {
    const manager = createThrottleManager({});
    const send = manager.wrapFetch(() => Promise.reject(new Error("boom")));

    await expect(send(urlFor("/v2/cdn/stories"))).rejects.toThrow("boom");
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

    // Far more than any built-in tier allows: a custom limiter owns the pacing.
    const { starts, settled } = sendThrough(manager, 200, "/v2/cdn/stories/my-story");
    await settled;

    expect(starts).toHaveLength(200);
    expect(acquired).toHaveLength(200);
  });

  it("should tell the limiter which quota the request draws from and at what rate", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });

    await sendThrough(manager, 1, "/v2/cdn/stories/my-story").settled;
    await sendThrough(manager, 1, "/v2/cdn/stories", { per_page: 100 }).settled;

    expect(acquired[0]).toMatchObject({ bucket: "SINGLE_OR_SMALL", limit: 50 });
    expect(acquired[1]).toMatchObject({ bucket: "VERY_LARGE", limit: 6 });
  });

  it("should report a single bucket and the configured rate in fixed-limit mode", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ requestsPerSecond: 7, limiter });

    await sendThrough(manager, 1, "/v2/cdn/stories/my-story").settled;
    await sendThrough(manager, 1, "/v2/cdn/stories", { per_page: 100 }).settled;

    expect(acquired[0]).toMatchObject({ bucket: "fixed", limit: 7 });
    expect(acquired[1]).toMatchObject({ bucket: "fixed", limit: 7 });
  });

  it("should never hand the access token to the limiter", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });

    await sendThrough(manager, 1, "/v2/cdn/stories", { per_page: 100 }).settled;

    expect(acquired[0]?.query).toEqual({ per_page: "100" });
  });

  it("should give each in-flight request its own context to correlate on", async () => {
    const { limiter, acquired, released } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });

    await sendThrough(manager, 3, "/v2/cdn/stories/my-story").settled;

    expect(new Set(acquired).size).toBe(3);
    // A limiter pairing a release to its acquire by identity has to find each
    // context it admitted.
    expect(acquired.every((context) => released.includes(context))).toBe(true);
  });

  it("should release the slot even when the request fails", async () => {
    const { limiter, released } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });
    const send = manager.wrapFetch(() => Promise.reject(new Error("boom")));

    await expect(send(urlFor("/v2/cdn/stories"))).rejects.toThrow("boom");

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

  const startedImmediately = (
    manager: ReturnType<typeof createThrottleManager>,
    path: string,
    count: number,
    query: Record<string, unknown> = {},
  ) => admittedNow(manager, count, path, query);

  it("should slow down after the API throttles a request", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 8 });
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    expect(await startedImmediately(manager, "/v2/cdn/stories", 20)).toBe(8);
    await vi.advanceTimersByTimeAsync(10_000);

    await fetchThrottled("https://api.storyblok.com/v2/cdn/stories");
    // The throttled request holds a slot in the current window.
    await vi.advanceTimersByTimeAsync(1000);

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

describe("createThrottleManager - limiter failures and retries", () => {
  afterEach(() => vi.useRealTimers());

  it("should make a retry win a slot of its own", async () => {
    const acquired: RateLimitContext[] = [];
    const limiter: RateLimiter = {
      acquire: async (context) => {
        acquired.push(context);
      },
    };
    const manager = createThrottleManager({ limiter });
    // Stands in for the HTTP layer retrying inside one call: admission that
    // only gated the call would let all of these through on one slot.
    const send = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    for (let i = 0; i < 4; i++) {
      await send(urlFor("/v2/cdn/stories"));
    }

    expect(acquired).toHaveLength(4);
  });

  it("should serve the response when the limiter fails to record it", async () => {
    const manager = createThrottleManager({
      limiter: {
        acquire: () => Promise.resolve(),
        recordResponse: () => Promise.reject(new Error("shared store unreachable")),
        release: () => Promise.reject(new Error("shared store unreachable")),
      },
    });
    const send = manager.wrapFetch(async () => new Response(null, { status: 200 }));

    // A blip in shared storage must not turn a served request into an error,
    // which inside the retry loop would also mean sending it again.
    await expect(send(urlFor("/v2/cdn/stories"))).resolves.toMatchObject({ status: 200 });
  });

  it("should leave the response body readable by the caller", async () => {
    const manager = createThrottleManager({
      limiter: {
        acquire: () => Promise.resolve(),
        recordResponse: async (_context, response) => {
          await response.text();
        },
      },
    });
    const send = manager.wrapFetch(async () => new Response("payload", { status: 200 }));

    const response = await send(urlFor("/v2/cdn/stories"));

    await expect(response.text()).resolves.toBe("payload");
  });

  it("should fail the request when the limiter refuses admission", async () => {
    const manager = createThrottleManager({
      limiter: { acquire: () => Promise.reject(new Error("no slot")) },
    });
    const send = manager.wrapFetch(async () => new Response(null, { status: 200 }));

    await expect(send(urlFor("/v2/cdn/stories"))).rejects.toThrow("no slot");
  });
});

describe("createThrottleManager({ cacheAware })", () => {
  afterEach(() => vi.useRealTimers());

  const LISTING = "/v2/cdn/stories";
  /** Large listings sit in the 6/s tier, which is the one worth outgrowing. */
  const LARGE = { per_page: 100 };

  /**
   * Answers every request with the given cache status, one per second, which is
   * how a client working through a warm — or cold — workload sees the API.
   */
  async function workFor(
    manager: ReturnType<typeof createThrottleManager>,
    seconds: number,
    headers?: Record<string, string>,
  ) {
    const send = manager.wrapFetch(async () => new Response(null, { status: 200, headers }));
    for (let i = 0; i < seconds; i++) {
      await send(urlFor(LISTING, LARGE));
      await vi.advanceTimersByTimeAsync(1000);
    }
  }

  it("should stay at the tier limit while the CDN serves the requests from the origin", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    await workFor(manager, 80, { "x-cache": "Miss from cloudfront" });

    expect(await admittedNow(manager, 100, LISTING, LARGE)).toBe(6);
  });

  it("should stay at the tier limit when the cache status is not readable", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    // A browser client cannot read the cache status: the API does not expose it
    // to cross-origin script.
    await workFor(manager, 80);

    expect(await admittedNow(manager, 100, LISTING, LARGE)).toBe(6);
  });

  it("should treat a revalidated cache entry as reaching the origin", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    await workFor(manager, 80, { "x-cache": "RefreshHit from cloudfront" });

    expect(await admittedNow(manager, 100, LISTING, LARGE)).toBe(6);
  });

  it("should reach the rate the cache serves once every response is a cache hit", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    await workFor(manager, 80, { "x-cache": "Hit from cloudfront" });

    expect(await admittedNow(manager, 2000, LISTING, LARGE)).toBe(1000);
  });

  it("should fall back to the tier limit when the workload turns cold", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    await workFor(manager, 80, { "x-cache": "Hit from cloudfront" });
    expect(await admittedNow(manager, 2000, LISTING, LARGE)).toBe(1000);
    await vi.advanceTimersByTimeAsync(10_000);

    await workFor(manager, 60, { "x-cache": "Miss from cloudfront" });

    expect(await admittedNow(manager, 100, LISTING, LARGE)).toBe(6);
  });

  it("should leave the tier at its limit when turned off", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ cacheAware: false });

    await workFor(manager, 80, { "x-cache": "Hit from cloudfront" });

    expect(await admittedNow(manager, 100, LISTING, LARGE)).toBe(6);
  });

  it("should never exceed an explicitly configured rate", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 8 });

    await workFor(manager, 80, { "x-cache": "Hit from cloudfront" });

    expect(await admittedNow(manager, 100, LISTING, LARGE)).toBe(8);
  });

  it("should raise only the tier whose requests the cache serves", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    await workFor(manager, 80, { "x-cache": "Hit from cloudfront" });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await admittedNow(manager, 100, "/v2/cdn/stories/home")).toBe(50);
  });
});

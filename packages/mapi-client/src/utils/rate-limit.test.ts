import { afterEach, describe, expect, it, vi } from "vitest";
import { createThrottleManager } from "./rate-limit";
import type { RateLimitContext, RateLimiter } from "./limiter";

const URL_UNDER_TEST = "https://mapi.storyblok.com/v1/spaces/1/stories";

/**
 * Sends requests through the manager's `fetch` wrapper, which is where
 * admission happens, and reports when each one was let through.
 */
function sendThrough(
  manager: ReturnType<typeof createThrottleManager>,
  count: number,
  status = 200,
) {
  const starts: number[] = [];
  const send = manager.wrapFetch(async () => {
    starts.push(Date.now());
    return new Response(null, { status });
  });
  const settled = Promise.all(Array.from({ length: count }, () => send(URL_UNDER_TEST)));
  return { starts, settled };
}

describe("createThrottleManager(false)", () => {
  afterEach(() => vi.useRealTimers());

  it("should send every request immediately without queuing", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(false);

    const { starts, settled } = sendThrough(manager, 100);
    await vi.advanceTimersByTimeAsync(0);

    expect(starts).toHaveLength(100);
    await settled;
  });
});

describe("createThrottleManager(number)", () => {
  afterEach(() => vi.useRealTimers());

  it("should start at most N requests per second", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(2);

    const { starts, settled } = sendThrough(manager, 3);

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(2);

    await vi.runAllTimersAsync();
    await settled;

    // The third request started in the second window.
    expect(starts).toHaveLength(3);
    expect(starts[2]! - starts[0]!).toBeGreaterThanOrEqual(1000);
  });
});

describe("createThrottleManager({})", () => {
  afterEach(() => vi.useRealTimers());

  it("should use default of 6 requests per second", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    const { starts, settled } = sendThrough(manager, 12);

    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(6);

    await vi.runAllTimersAsync();
    await settled;
    expect(starts).toHaveLength(12);
  });

  it("should propagate a transport failure to the caller", async () => {
    const manager = createThrottleManager({});
    const send = manager.wrapFetch(() => Promise.reject(new Error("boom")));

    await expect(send(URL_UNDER_TEST)).rejects.toThrow("boom");
  });
});

describe("createThrottleManager({ limiter })", () => {
  afterEach(() => vi.useRealTimers());

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
    const { starts, settled } = sendThrough(manager, 200);

    await settled;

    // Far beyond the built-in default: a custom limiter owns the pacing.
    expect(starts).toHaveLength(200);
    expect(acquired).toHaveLength(200);
  });

  it("should tell the limiter the rate the client would have used", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ requestsPerSecond: 9, limiter });
    const { settled } = sendThrough(manager, 1);

    await settled;

    expect(acquired[0]).toMatchObject({
      bucket: "management-api",
      limit: 9,
      path: "/v1/spaces/1/stories",
    });
  });

  it("should release the slot even when the request fails", async () => {
    const { limiter, released } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });
    const send = manager.wrapFetch(() => Promise.reject(new Error("boom")));

    await expect(send(URL_UNDER_TEST)).rejects.toThrow("boom");

    expect(released).toHaveLength(1);
  });

  it("should give each in-flight request its own context to correlate on", async () => {
    const { limiter, acquired, released } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });
    const { settled } = sendThrough(manager, 3);

    await settled;

    expect(new Set(acquired).size).toBe(3);
    // A limiter pairing a release to its acquire by identity has to find each
    // context it admitted.
    expect(acquired.every((context) => released.includes(context))).toBe(true);
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
      await fetchWithRetries("https://mapi.storyblok.com/v1/spaces/1/stories");
    }

    expect(recorded.map((entry) => entry.status)).toEqual(statuses);
    expect(recorded[0]?.context.path).toBe("/v1/spaces/1/stories");
  });
});

describe("createThrottleManager({ adaptive })", () => {
  afterEach(() => vi.useRealTimers());

  /**
   * Reports how many requests the manager admits right now. The probe fails at
   * the transport, so it consumes slots without reporting a response — reading
   * the rate must not also move it.
   */
  const startedImmediately = async (
    manager: ReturnType<typeof createThrottleManager>,
    count: number,
  ) => {
    let started = 0;
    const send = manager.wrapFetch(() => {
      started++;
      return Promise.reject(new Error("probe"));
    });
    for (let i = 0; i < count; i++) {
      void send(URL_UNDER_TEST).catch(() => {});
    }
    await vi.advanceTimersByTimeAsync(0);
    return started;
  };

  it("should slow down after the API throttles a request", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(8);
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    expect(await startedImmediately(manager, 20)).toBe(8);
    await vi.advanceTimersByTimeAsync(10_000);

    await fetchThrottled("https://mapi.storyblok.com/v1/spaces/1/stories");
    await vi.advanceTimersByTimeAsync(1000);

    expect(await startedImmediately(manager, 20)).toBe(4);
  });

  it("should hold the configured rate when adaptation is off", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ requestsPerSecond: 8, adaptive: false });
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    await fetchThrottled("https://mapi.storyblok.com/v1/spaces/1/stories");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await startedImmediately(manager, 20)).toBe(8);
  });

  it("should recover towards the configured rate while nothing is throttled", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(8);
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));
    const fetchOk = manager.wrapFetch(async () => new Response(null, { status: 200 }));

    await fetchThrottled("https://mapi.storyblok.com/v1/spaces/1/stories");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await startedImmediately(manager, 20)).toBe(4);
    await vi.advanceTimersByTimeAsync(10_000);

    await fetchOk("https://mapi.storyblok.com/v1/spaces/1/stories");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await startedImmediately(manager, 20)).toBe(5);
  });
});

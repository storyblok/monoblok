import { afterEach, describe, expect, it, vi } from "vitest";
import { createThrottleManager } from "./rate-limit";
import type { RateLimitContext, RateLimiter } from "./limiter";

describe("createThrottleManager(false)", () => {
  it("should execute the function immediately without queuing", async () => {
    const manager = createThrottleManager(false);
    const fn = vi.fn().mockResolvedValue("result");
    const result = await manager.execute(fn);
    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe("createThrottleManager(number)", () => {
  afterEach(() => vi.useRealTimers());

  it("should start at most N requests per second", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(2);

    const starts: number[] = [];
    const makeFn = () => async () => {
      starts.push(Date.now());
      return "done";
    };

    const p1 = manager.execute(makeFn());
    const p2 = manager.execute(makeFn());
    const p3 = manager.execute(makeFn()); // must wait for next window

    // Flush microtasks so the first two slots are acquired.
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(2);

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2, p3]);

    // Third request started in the second window (≥1000ms later).
    expect(starts).toHaveLength(3);
    expect(starts[2]! - starts[0]!).toBeGreaterThanOrEqual(1000);
  });
});

describe("createThrottleManager({})", () => {
  afterEach(() => vi.useRealTimers());

  it("should use default of 6 requests per second", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    const starts: number[] = [];
    const makeFn = () => async () => {
      starts.push(Date.now());
      return "done";
    };

    const promises = Array.from({ length: 12 }, () => manager.execute(makeFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // At most 6 start in the first window.
    const firstWindowStarts = starts.filter((t) => t < starts[0]! + 1000);
    expect(firstWindowStarts.length).toBeLessThanOrEqual(6);
  });

  it("should propagate errors from the wrapped function", async () => {
    const manager = createThrottleManager({});
    const error = new Error("boom");
    await expect(manager.execute(() => Promise.reject(error))).rejects.toThrow("boom");
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
    const fn = vi.fn(async () => "done");

    // Far beyond the built-in default: a custom limiter owns the pacing.
    await Promise.all(Array.from({ length: 200 }, () => manager.execute(fn)));

    expect(fn).toHaveBeenCalledTimes(200);
    expect(acquired).toHaveLength(200);
  });

  it("should tell the limiter the rate the client would have used", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const manager = createThrottleManager({ requestsPerSecond: 9, limiter });

    await manager.execute(async () => "done");

    expect(acquired[0]).toMatchObject({ bucket: "management-api", limit: 9 });
  });

  it("should release the slot even when the request fails", async () => {
    const { limiter, released } = createRecordingLimiter();
    const manager = createThrottleManager({ limiter });

    await expect(
      manager.execute(async () => {
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
      await fetchWithRetries("https://mapi.storyblok.com/v1/spaces/1/stories");
    }

    expect(recorded.map((entry) => entry.status)).toEqual(statuses);
    expect(recorded[0]?.context.path).toBe("/v1/spaces/1/stories");
  });
});

describe("createThrottleManager({ adaptive })", () => {
  afterEach(() => vi.useRealTimers());

  const startedImmediately = async (
    manager: ReturnType<typeof createThrottleManager>,
    count: number,
  ) => {
    const fn = vi.fn(async () => "done");
    for (let i = 0; i < count; i++) {
      void manager.execute(fn);
    }
    await vi.advanceTimersByTimeAsync(0);
    return fn.mock.calls.length;
  };

  it("should slow down after the API throttles a request", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(8);
    const fetchThrottled = manager.wrapFetch(async () => new Response(null, { status: 429 }));

    expect(await startedImmediately(manager, 20)).toBe(8);
    await vi.advanceTimersByTimeAsync(10_000);

    await fetchThrottled("https://mapi.storyblok.com/v1/spaces/1/stories");

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

import { afterEach, describe, expect, it, vi } from "vitest";
import { createThrottleManager } from "./rate-limit";

describe("createThrottleManager(false)", () => {
  it("should execute the function immediately without queuing", async () => {
    const manager = createThrottleManager(false);
    const fn = vi.fn().mockResolvedValue("result");
    const result = await manager.execute(fn);
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

  it("should limit concurrent requests to the specified number", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(2);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 100));
      activeCount--;
      return "done";
    };

    const p1 = manager.execute(makeSlowFn());
    const p2 = manager.execute(makeSlowFn());
    const p3 = manager.execute(makeSlowFn());

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2, p3]);

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("should adapt limit from server headers, respecting user ceiling", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(50);

    let activeCount = 0;
    let maxActive = 0;

    const serverResponse = new Response(null, {
      headers: { "x-ratelimit-policy": '"concurrent-requests";q=5' },
    });
    manager.adaptToResponse(serverResponse);

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeCount--;
      return "done";
    };

    const promises = Array.from({ length: 10 }, () => manager.execute(makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // Server said 5, user ceiling is 50 -> effective limit is min(50, 5) = 5.
    expect(maxActive).toBeLessThanOrEqual(5);
  });

  it("should not exceed user ceiling even if server reports higher", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(3);

    const serverResponse = new Response(null, {
      headers: { "x-ratelimit-policy": '"concurrent-requests";q=100' },
    });
    manager.adaptToResponse(serverResponse);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeCount--;
      return "done";
    };

    const promises = Array.from({ length: 9 }, () => manager.execute(makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxActive).toBeLessThanOrEqual(3);
  });
});

describe("createThrottleManager({})", () => {
  afterEach(() => vi.useRealTimers());

  it("should use default maxConcurrency of 6", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeCount--;
      return "done";
    };

    const promises = Array.from({ length: 12 }, () => manager.execute(makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxActive).toBeLessThanOrEqual(6);
  });

  it("should adapt limit from server headers", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    const serverResponse = new Response(null, {
      headers: { "x-ratelimit-policy": '"concurrent-requests";q=3' },
    });
    manager.adaptToResponse(serverResponse);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeCount--;
      return "done";
    };

    const promises = Array.from({ length: 10 }, () => manager.execute(makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // Default is 6, server said 3 -> effective limit is min(6, 3) = 3.
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("should ignore server headers when adaptToServerHeaders is false", async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ adaptToServerHeaders: false });

    const serverResponse = new Response(null, {
      headers: { "x-ratelimit-policy": '"concurrent-requests";q=1' },
    });
    manager.adaptToResponse(serverResponse);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeCount--;
      return "done";
    };

    // With limit ignored, the default 6 slots should be available.
    const promises = Array.from({ length: 6 }, () => manager.execute(makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxActive).toBe(6);
  });

  it("should propagate errors from the wrapped function", async () => {
    const manager = createThrottleManager({});
    const error = new Error("boom");
    await expect(manager.execute(() => Promise.reject(error))).rejects.toThrow("boom");
  });

  it("should treat adaptToResponse as a no-op when response is undefined", () => {
    const manager = createThrottleManager({});
    expect(() => manager.adaptToResponse(undefined)).not.toThrow();
  });
});

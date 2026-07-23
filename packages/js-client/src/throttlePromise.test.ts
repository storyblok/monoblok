import { describe, expect, it, vi } from 'vitest';
import throttledQueue from './throttlePromise';

describe('throttledQueue (per-second rate limiter)', () => {
  it('allows up to `limit` calls to start within a rolling interval', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      const throttled = throttledQueue(fn, 3, 1000);

      for (let i = 0; i < 7; i++) {
        throttled(i);
      }

      // First window: only `limit` calls start.
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(3);

      // Each further window admits `limit` more.
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(6);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(7);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it('eventually resolves every call with its own result under sustained load', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      const throttled = throttledQueue(fn, 2, 1000);

      const results: number[] = [];
      const promises = Array.from({ length: 5 }, (_, i) =>
        throttled(i).then((value) => {
          results.push(value as number);
          return value;
        }));

      await vi.advanceTimersByTimeAsync(3000);
      await Promise.all(promises);

      expect(results.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it('does not leak state across requests spaced beyond the window (Cloudflare Workers regression #533)', async () => {
    // On Cloudflare Workers the isolate can suspend between requests and drop
    // pending timers. A limiter that released its slots from such a timer would
    // leak its in-flight count across requests and eventually deadlock. This
    // limiter prunes its window by wall clock on every call, so a long sequence
    // of well-spaced requests must always start immediately: nothing
    // accumulates. Regression guard for #533.
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      const throttled = throttledQueue(fn, 2, 1000);

      for (let i = 0; i < 50; i++) {
        const pending = throttled(i);
        await vi.advanceTimersByTimeAsync(0); // flush microtasks only
        expect(fn).toHaveBeenCalledTimes(i + 1); // started with no wait
        await pending;
        await vi.advanceTimersByTimeAsync(1000); // let the window clear
      }
    }
    finally {
      vi.useRealTimers();
    }
  });

  it('rejects pending calls with an AbortError when aborted; in-flight calls still settle', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      const throttled = throttledQueue(fn, 1, 1000);

      const inFlight = throttled(0); // starts immediately
      const pending = throttled(1); // waits for the next window
      await vi.advanceTimersByTimeAsync(0);

      throttled.abort?.();

      await expect(pending).rejects.toBeInstanceOf(Error);
      await expect(pending).rejects.toHaveProperty('name', 'AbortError');
      await expect(inFlight).resolves.toBe(0);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it('does not throttle when the limit is non-positive or infinite', async () => {
    const fn = vi.fn(async (i: number) => i);

    for (const limit of [0, Number.POSITIVE_INFINITY]) {
      const throttled = throttledQueue(fn, limit, 1000);
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) => throttled(i)),
      );
      expect(results).toEqual([0, 1, 2, 3, 4]);
    }
  });
});

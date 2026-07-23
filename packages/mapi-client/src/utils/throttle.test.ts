// This file is duplicated verbatim in @storyblok/api-client and
// @storyblok/management-api-client. The two copies must stay identical; apply
// any change to both.

import { describe, expect, it, vi } from 'vitest';
import { createThrottle } from './throttle';

describe('createThrottle (per-second rate limiter)', () => {
  it('allows up to `limit` calls to start within a rolling interval', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      const throttle = createThrottle(3);

      for (let i = 0; i < 7; i++) {
        throttle.execute(() => fn(i));
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
      const throttle = createThrottle(2);

      const results: number[] = [];
      const promises = Array.from({ length: 5 }, (_, i) =>
        throttle.execute(async () => i).then((value) => {
          results.push(value);
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

  it('applies a raised limit set via setLimit to later windows', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      const throttle = createThrottle(2);

      throttle.setLimit(4);
      for (let i = 0; i < 5; i++) {
        throttle.execute(() => fn(i));
      }

      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(4);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(5);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it('does not leak state across calls spaced beyond the window', async () => {
    // On Cloudflare Workers the isolate can suspend between requests and drop
    // pending timers. A limiter that released its slots from such a timer would
    // leak its in-flight count across requests and eventually deadlock. This
    // limiter prunes its window by wall clock on every call, so a long sequence
    // of well-spaced calls must always start immediately: nothing accumulates.
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      const throttle = createThrottle(2);

      for (let i = 0; i < 50; i++) {
        const pending = throttle.execute(() => fn(i));
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

  it('does not throttle when the limit is non-positive or infinite', async () => {
    for (const limit of [0, Number.POSITIVE_INFINITY]) {
      const fn = vi.fn(async (i: number) => i);
      const throttle = createThrottle(limit);
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) => throttle.execute(() => fn(i))),
      );
      expect(results).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('propagates errors from the wrapped function', async () => {
    const throttle = createThrottle(5);
    await expect(
      throttle.execute(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
  });
});

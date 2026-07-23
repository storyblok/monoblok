import { describe, expect, it, vi } from 'vitest';
import throttledQueue from './throttlePromise';

// Mock function to simulate async work with a delay
const mockFn = vi.fn(async (input) => {
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate async delay
  return input;
});

describe('throttledQueue', () => {
  it('should resolve or reject all promises after the queue finishes, even when aborting', async () => {
    const throttled = throttledQueue(mockFn, 3, 10); // Throttle with 3 concurrent tasks
    const promises: Promise<any>[] = [];

    // Generate 10 tasks and push them to the promises array
    for (let i = 0; i < 10; i++) {
      promises.push(throttled(i));
      if (i === 5) {
        throttled.abort?.(); // but abort at call #6
      }
    }

    const results = await Promise.allSettled(promises);
    results.forEach((result) => {
      expect(['fulfilled', 'rejected']).toContain(result.status);
    });
  });

  it('should limit concurrency and preserve order when the limit is exceeded', async () => {
    const throttled = throttledQueue(mockFn, 1, 100); // Concurrency limit of 1

    const start = Date.now();
    const promises = [
      throttled('test1'),
      throttled('test2'),
      throttled('test3'),
    ];

    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    // With a concurrency limit of 1, each 200ms call runs strictly after the
    // previous one completes, so the total is at least 3 * 200ms and the
    // results keep their submission order.
    expect(results).toEqual(['test1', 'test2', 'test3']);
    expect(duration).toBeGreaterThanOrEqual(600);
  });

  it('drains the queue without depending on scheduled timers (Cloudflare Workers regression #533)', async () => {
    // On Cloudflare Workers the isolate can suspend after the response is sent,
    // before a scheduled setTimeout fires. Draining must therefore be driven by
    // request completion, not by a timer. Simulate the suspended isolate by
    // flushing microtasks while leaving every scheduled timer pending.
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i); // resolves via microtask, no timer
      const throttled = throttledQueue(fn, 3, 1000);
      const settled: number[] = [];
      const promises = Array.from({ length: 6 }, (_, i) =>
        throttled(i).then((value) => {
          settled.push(value as number);
          return value;
        }));

      // Flush microtasks only; every scheduled timer stays pending.
      await vi.advanceTimersByTimeAsync(0);

      expect(settled.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
      await Promise.all(promises);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it('rejects queued promises with an AbortError when aborted', async () => {
    const throttled = throttledQueue(mockFn, 1, 10);

    const inFlight = throttled('a'); // occupies the only concurrency slot
    const queued = throttled('b'); // waits in the queue

    throttled.abort?.();

    await expect(queued).rejects.toBeInstanceOf(Error);
    await expect(queued).rejects.toHaveProperty('name', 'AbortError');
    await expect(inFlight).resolves.toBe('a'); // in-flight request still settles
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

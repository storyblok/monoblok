import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThrottleManager } from './rate-limit';

describe('createThrottleManager(false)', () => {
  it('should execute the function immediately without queuing', async () => {
    const manager = createThrottleManager(false);
    const fn = vi.fn().mockResolvedValue('result');
    const result = await manager.execute(fn);
    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('createThrottleManager(number)', () => {
  afterEach(() => vi.useRealTimers());

  it('should start at most N requests per second', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(2);

    const starts: number[] = [];
    const makeFn = () => async () => {
      starts.push(Date.now());
      return 'done';
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

describe('createThrottleManager({})', () => {
  afterEach(() => vi.useRealTimers());

  it('should use default of 6 requests per second', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    const starts: number[] = [];
    const makeFn = () => async () => {
      starts.push(Date.now());
      return 'done';
    };

    const promises = Array.from({ length: 12 }, () => manager.execute(makeFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // At most 6 start in the first window.
    const firstWindowStarts = starts.filter(t => t < starts[0]! + 1000);
    expect(firstWindowStarts.length).toBeLessThanOrEqual(6);
  });

  it('should propagate errors from the wrapped function', async () => {
    const manager = createThrottleManager({});
    const error = new Error('boom');
    await expect(
      manager.execute(() => Promise.reject(error)),
    ).rejects.toThrow('boom');
  });
});

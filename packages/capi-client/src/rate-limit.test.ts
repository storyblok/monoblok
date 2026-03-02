import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThrottleManager, determineTier, parseRateLimitPolicyHeader } from './rate-limit';

// ---------------------------------------------------------------------------
// determineTier
// ---------------------------------------------------------------------------

describe('determineTier()', () => {
  it('returns SINGLE_OR_SMALL for a single story path', () => {
    expect(determineTier('/v2/cdn/stories/my-story', {})).toBe('SINGLE_OR_SMALL');
    // Nested slugs — per_page > 25 is supplied to confirm it's the regex, not the per_page default.
    expect(determineTier('/v2/cdn/stories/folder/nested-story', { per_page: 100 })).toBe('SINGLE_OR_SMALL');
  });

  it('returns SINGLE_OR_SMALL when per_page is absent (default 25)', () => {
    expect(determineTier('/v2/cdn/stories', {})).toBe('SINGLE_OR_SMALL');
  });

  it('returns SINGLE_OR_SMALL for per_page ≤ 25', () => {
    expect(determineTier('/v2/cdn/stories', { per_page: 1 })).toBe('SINGLE_OR_SMALL');
    expect(determineTier('/v2/cdn/stories', { per_page: 25 })).toBe('SINGLE_OR_SMALL');
  });

  it('returns MEDIUM for per_page 26–50', () => {
    expect(determineTier('/v2/cdn/stories', { per_page: 26 })).toBe('MEDIUM');
    expect(determineTier('/v2/cdn/stories', { per_page: 50 })).toBe('MEDIUM');
  });

  it('returns LARGE for per_page 51–75', () => {
    expect(determineTier('/v2/cdn/stories', { per_page: 51 })).toBe('LARGE');
    expect(determineTier('/v2/cdn/stories', { per_page: 75 })).toBe('LARGE');
  });

  it('returns VERY_LARGE for per_page > 75', () => {
    expect(determineTier('/v2/cdn/stories', { per_page: 76 })).toBe('VERY_LARGE');
    expect(determineTier('/v2/cdn/stories', { per_page: 100 })).toBe('VERY_LARGE');
  });

  it('parses per_page when provided as a string', () => {
    expect(determineTier('/v2/cdn/stories', { per_page: '26' })).toBe('MEDIUM');
  });

  it('falls back to SINGLE_OR_SMALL for an unparseable per_page string', () => {
    expect(determineTier('/v2/cdn/stories', { per_page: 'invalid' })).toBe('SINGLE_OR_SMALL');
  });

  it('does NOT treat /v2/cdn/stories (no trailing identifier) as single story', () => {
    expect(determineTier('/v2/cdn/stories', {})).toBe('SINGLE_OR_SMALL');
    // Still SINGLE_OR_SMALL here because per_page defaults to 25, but it's
    // because of per_page, not single-story detection.
    expect(determineTier('/v2/cdn/stories', { per_page: 50 })).toBe('MEDIUM');
  });

  it('works for non-story paths (links, tags, etc.)', () => {
    expect(determineTier('/v2/cdn/links', { per_page: 100 })).toBe('VERY_LARGE');
    expect(determineTier('/v2/cdn/tags', {})).toBe('SINGLE_OR_SMALL');
  });
});

// ---------------------------------------------------------------------------
// parseRateLimitPolicyHeader
// ---------------------------------------------------------------------------

describe('parseRateLimitPolicyHeader()', () => {
  const makeResponse = (headerValue: string | null) =>
    new Response(null, {
      headers: headerValue ? { 'x-ratelimit-policy': headerValue } : {},
    });

  it('parses the q= value from the header', () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"concurrent-requests";q=30'))).toBe(30);
  });

  it('returns undefined when the header is absent', () => {
    expect(parseRateLimitPolicyHeader(makeResponse(null))).toBeUndefined();
  });

  it('returns undefined when the header has no q= value', () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"concurrent-requests";r=5'))).toBeUndefined();
  });

  it('caps the parsed value at 1000', () => {
    expect(parseRateLimitPolicyHeader(makeResponse('"concurrent-requests";q=9999'))).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// createThrottleManager — passthrough (false)
// ---------------------------------------------------------------------------

describe('createThrottleManager(false)', () => {
  it('executes the function immediately without queuing', async () => {
    const manager = createThrottleManager(false);
    const fn = vi.fn().mockResolvedValue('result');
    const result = await manager.execute('/v2/cdn/stories', {}, fn);
    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('adaptToResponse is a no-op', () => {
    const manager = createThrottleManager(false);
    expect(() => manager.adaptToResponse(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createThrottleManager — fixed limit (number shorthand)
// ---------------------------------------------------------------------------

describe('createThrottleManager(number)', () => {
  afterEach(() => vi.useRealTimers());

  it('limits concurrent requests to the specified number', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(2);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 100));
      activeCount--;
      return 'done';
    };

    const p1 = manager.execute('/v2/cdn/stories', {}, makeSlowFn());
    const p2 = manager.execute('/v2/cdn/stories', {}, makeSlowFn());
    const p3 = manager.execute('/v2/cdn/stories', {}, makeSlowFn());

    // Advance past the slow function delay; the throttle interval is 1 s.
    await vi.runAllTimersAsync();
    await Promise.all([p1, p2, p3]);

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('adapts limit from server headers, respecting user ceiling', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(50);

    let activeCount = 0;
    let maxActive = 0;

    const serverResponse = new Response(null, {
      headers: { 'x-ratelimit-policy': '"concurrent-requests";q=5' },
    });
    // Tell the manager the server reported a limit of 5.
    manager.adaptToResponse(serverResponse);

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return 'done';
    };

    const promises = Array.from({ length: 10 }, () => manager.execute('/v2/cdn/stories', {}, makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // Server said 5, user ceiling is 50 → effective limit is min(50,5) = 5.
    expect(maxActive).toBeLessThanOrEqual(5);
  });

  it('does not exceed user ceiling even if server reports higher', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager(3);

    const serverResponse = new Response(null, {
      headers: { 'x-ratelimit-policy': '"concurrent-requests";q=100' },
    });
    manager.adaptToResponse(serverResponse);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return 'done';
    };

    const promises = Array.from({ length: 9 }, () => manager.execute('/v2/cdn/stories', {}, makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxActive).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// createThrottleManager — auto-detect mode (default / {})
// ---------------------------------------------------------------------------

describe('createThrottleManager({})', () => {
  afterEach(() => vi.useRealTimers());

  it('routes single-story paths to the SINGLE_OR_SMALL tier (50 req/s)', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return 'done';
    };

    // 50 concurrent requests on a single-story path should all start immediately.
    const promises = Array.from({ length: 50 }, () =>
      manager.execute('/v2/cdn/stories/my-story', {}, makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxActive).toBe(50);
  });

  it('routes large per_page to the VERY_LARGE tier (6 req/s)', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return 'done';
    };

    const promises = Array.from({ length: 12 }, () =>
      manager.execute('/v2/cdn/stories', { per_page: 100 }, makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxActive).toBeLessThanOrEqual(6);
  });

  it('adapts SINGLE_OR_SMALL tier from server headers', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({});

    const serverResponse = new Response(null, {
      headers: { 'x-ratelimit-policy': '"concurrent-requests";q=10' },
    });
    manager.adaptToResponse(serverResponse);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return 'done';
    };

    const promises = Array.from({ length: 20 }, () =>
      manager.execute('/v2/cdn/stories/my-story', {}, makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    // Default is 50, server said 10 → effective limit is min(50, 10) = 10.
    expect(maxActive).toBeLessThanOrEqual(10);
  });

  it('ignores server headers when adaptToServerHeaders is false', async () => {
    vi.useFakeTimers();
    const manager = createThrottleManager({ adaptToServerHeaders: false });

    const serverResponse = new Response(null, {
      headers: { 'x-ratelimit-policy': '"concurrent-requests";q=1' },
    });
    manager.adaptToResponse(serverResponse);

    let activeCount = 0;
    let maxActive = 0;

    const makeSlowFn = () => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return 'done';
    };

    // With limit ignored, the default 50 slots should be available.
    const promises = Array.from({ length: 50 }, () =>
      manager.execute('/v2/cdn/stories/my-story', {}, makeSlowFn()));

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxActive).toBe(50);
  });

  it('propagates errors from the wrapped function', async () => {
    const manager = createThrottleManager({});
    const error = new Error('boom');
    await expect(
      manager.execute('/v2/cdn/stories', {}, () => Promise.reject(error)),
    ).rejects.toThrow('boom');
  });

  it('adaptToResponse is a no-op when response is undefined', () => {
    const manager = createThrottleManager({});
    expect(() => manager.adaptToResponse(undefined)).not.toThrow();
  });
});

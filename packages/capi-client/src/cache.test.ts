import { describe, expect, it, vi } from 'vitest';
import {
  type CacheEntry,
  createCacheFirstStrategy,
  createMemoryCacheProvider,
  createNetworkFirstStrategy,
  createSwrStrategy,
} from './cache';

describe('createMemoryCacheProvider', () => {
  it('get() returns undefined for missing keys', async () => {
    const provider = createMemoryCacheProvider();

    await expect(provider.get('missing')).resolves.toBeUndefined();
  });

  it('set() then get() returns the entry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider();
    const entry: CacheEntry = {
      value: { ok: true },
      storedAt: Date.now(),
      ttlMs: 100,
    };

    await provider.set('key', entry);

    await expect(provider.get('key')).resolves.toEqual(entry);
    vi.useRealTimers();
  });

  it('set() uses Date.now() when storedAt is omitted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider();

    await provider.set('key', {
      value: { ok: true },
      ttlMs: 100,
    });

    await expect(provider.get('key')).resolves.toEqual({
      value: { ok: true },
      storedAt: 1_000,
      ttlMs: 100,
    });
    vi.useRealTimers();
  });

  it('get() returns undefined for expired entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider();

    await provider.set('key', {
      value: 'value',
      storedAt: Date.now(),
      ttlMs: 100,
    });

    await vi.advanceTimersByTimeAsync(101);

    await expect(provider.get('key')).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('get() returns entry when within TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider();
    const entry: CacheEntry = {
      value: 'value',
      storedAt: Date.now(),
      ttlMs: 100,
    };

    await provider.set('key', entry);
    await vi.advanceTimersByTimeAsync(99);

    await expect(provider.get('key')).resolves.toEqual(entry);
    vi.useRealTimers();
  });

  it('get() deletes expired entry from map', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider();

    await provider.set('key', {
      value: 'stale',
      storedAt: Date.now(),
      ttlMs: 100,
    });

    await vi.advanceTimersByTimeAsync(101);
    await expect(provider.get('key')).resolves.toBeUndefined();

    vi.setSystemTime(1_050);
    await expect(provider.get('key')).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('flush() clears all entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider();

    await provider.set('first', {
      value: 1,
      storedAt: Date.now(),
      ttlMs: 100,
    });
    await provider.set('second', {
      value: 2,
      storedAt: Date.now(),
      ttlMs: 100,
    });

    await provider.flush();

    await expect(provider.get('first')).resolves.toBeUndefined();
    await expect(provider.get('second')).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('keeps entry valid exactly at TTL boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider();
    const entry: CacheEntry = {
      value: 'value',
      storedAt: Date.now(),
      ttlMs: 100,
    };

    await provider.set('key', entry);
    await vi.advanceTimersByTimeAsync(100);

    await expect(provider.get('key')).resolves.toEqual(entry);
    vi.useRealTimers();
  });

  it('evicts oldest entry when max entries is exceeded', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider({ maxEntries: 2 });

    await provider.set('a', {
      value: 'a',
      storedAt: Date.now(),
      ttlMs: 1_000,
    });
    await provider.set('b', {
      value: 'b',
      storedAt: Date.now(),
      ttlMs: 1_000,
    });
    await provider.set('c', {
      value: 'c',
      storedAt: Date.now(),
      ttlMs: 1_000,
    });

    await expect(provider.get('a')).resolves.toBeUndefined();
    await expect(provider.get('b')).resolves.toBeDefined();
    await expect(provider.get('c')).resolves.toBeDefined();
    vi.useRealTimers();
  });

  it('uses LRU order when updating an existing key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const provider = createMemoryCacheProvider({ maxEntries: 2 });

    await provider.set('a', {
      value: 'a',
      storedAt: Date.now(),
      ttlMs: 1_000,
    });
    await provider.set('b', {
      value: 'b',
      storedAt: Date.now(),
      ttlMs: 1_000,
    });

    await provider.set('a', {
      value: 'a-new',
      storedAt: Date.now(),
      ttlMs: 1_000,
    });

    await provider.set('c', {
      value: 'c',
      storedAt: Date.now(),
      ttlMs: 1_000,
    });

    await expect(provider.get('b')).resolves.toBeUndefined();
    await expect(provider.get('a')).resolves.toBeDefined();
    await expect(provider.get('c')).resolves.toBeDefined();
    vi.useRealTimers();
  });
});

describe('cache strategies', () => {
  it('cache-first returns cached result when available', async () => {
    const strategy = createCacheFirstStrategy();
    const loadNetwork = vi.fn().mockResolvedValue('network');

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('cached');
    expect(loadNetwork).not.toHaveBeenCalled();
  });

  it('cache-first calls network when no cached result', async () => {
    const strategy = createCacheFirstStrategy();
    const loadNetwork = vi.fn().mockResolvedValue('network');

    const result = await strategy({
      key: 'k',
      cachedResult: undefined,
      loadNetwork,
    });

    expect(result).toBe('network');
    expect(loadNetwork).toHaveBeenCalledTimes(1);
  });

  it('network-first returns network result on success', async () => {
    const strategy = createNetworkFirstStrategy();
    const loadNetwork = vi.fn().mockResolvedValue('network');

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('network');
  });

  it('network-first falls back to cached result on network error', async () => {
    const strategy = createNetworkFirstStrategy();
    const loadNetwork = vi.fn().mockRejectedValue(new Error('boom'));

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('cached');
  });

  it('network-first throws when no cached result exists', async () => {
    const strategy = createNetworkFirstStrategy();
    const loadNetwork = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(strategy({
      key: 'k',
      cachedResult: undefined,
      loadNetwork,
    })).rejects.toThrow('boom');
  });

  it('swr returns cached result and refreshes in background', async () => {
    const strategy = createSwrStrategy();
    const loadNetwork = vi.fn().mockResolvedValue('updated');

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('cached');
    expect(loadNetwork).toHaveBeenCalledTimes(1);
  });

  it('swr does not block on refresh failures', async () => {
    const strategy = createSwrStrategy();
    const loadNetwork = vi.fn().mockRejectedValue(new Error('refresh failed'));

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('cached');
  });

  it('swr loads from network when no cached result exists', async () => {
    const strategy = createSwrStrategy();
    const loadNetwork = vi.fn().mockResolvedValue('fresh');

    const result = await strategy({
      key: 'k',
      cachedResult: undefined,
      loadNetwork,
    });

    expect(result).toBe('fresh');
    expect(loadNetwork).toHaveBeenCalledTimes(1);
  });

  it('swr deduplicates background revalidation by cache key', async () => {
    let resolveRefresh: (() => void) | undefined;
    const refreshPromise = new Promise<string>((resolve) => {
      resolveRefresh = () => resolve('updated');
    });
    const strategy = createSwrStrategy();
    const loadNetwork = vi.fn().mockImplementation(() => refreshPromise);

    const first = strategy({
      key: 'same-key',
      cachedResult: 'cached',
      loadNetwork,
    });
    const second = strategy({
      key: 'same-key',
      cachedResult: 'cached',
      loadNetwork,
    });

    await expect(first).resolves.toBe('cached');
    await expect(second).resolves.toBe('cached');
    expect(loadNetwork).toHaveBeenCalledTimes(1);

    resolveRefresh?.();
    await refreshPromise;
  });
});

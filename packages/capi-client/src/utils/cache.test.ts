import { describe, expect, it, vi } from 'vitest';
import {
  type CacheEntry,
  createCacheFirstStrategy,
  createMemoryCacheProvider,
  createNetworkFirstStrategy,
  createSwrStrategy,
} from './cache';

describe('createMemoryCacheProvider', () => {
  it('should return undefined for missing keys in get()', async () => {
    const provider = createMemoryCacheProvider();

    await expect(provider.get('missing')).resolves.toBeUndefined();
  });

  it('should return the entry after set() then get()', async () => {
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

  it('should use Date.now() when storedAt is omitted in set()', async () => {
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

  it('should return undefined for expired entries in get()', async () => {
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

  it('should return entry when within TTL in get()', async () => {
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

  it('should delete expired entry from map in get()', async () => {
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

  it('should clear all entries in flush()', async () => {
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

  it('should keep entry valid exactly at TTL boundary', async () => {
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

  it('should evict oldest entry when max entries is exceeded', async () => {
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

  it('should use LRU order when updating an existing key', async () => {
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

    await expect(provider.get('a')).resolves.toBeDefined();
    await expect(provider.get('b')).resolves.toBeUndefined();
    await expect(provider.get('c')).resolves.toBeDefined();
    vi.useRealTimers();
  });
});

describe('cache strategies', () => {
  it('should return cached result with cache-first when available', async () => {
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

  it('should call network with cache-first when no cached result', async () => {
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

  it('should return network result with network-first on success', async () => {
    const strategy = createNetworkFirstStrategy();
    const loadNetwork = vi.fn().mockResolvedValue('network');

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('network');
  });

  it('should fall back to cached result with network-first on network error', async () => {
    const strategy = createNetworkFirstStrategy();
    const loadNetwork = vi.fn().mockRejectedValue(new Error('boom'));

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('cached');
  });

  it('should throw with network-first when no cached result exists', async () => {
    const strategy = createNetworkFirstStrategy();
    const loadNetwork = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(strategy({
      key: 'k',
      cachedResult: undefined,
      loadNetwork,
    })).rejects.toThrow('boom');
  });

  it('should return cached result and refresh in background with swr', async () => {
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

  it('should not block on refresh failures with swr', async () => {
    const strategy = createSwrStrategy();
    const loadNetwork = vi.fn().mockRejectedValue(new Error('refresh failed'));

    const result = await strategy({
      key: 'k',
      cachedResult: 'cached',
      loadNetwork,
    });

    expect(result).toBe('cached');
  });

  it('should load from network with swr when no cached result exists', async () => {
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

  it('should deduplicate background revalidation by cache key with swr', async () => {
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

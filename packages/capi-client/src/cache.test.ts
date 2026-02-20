import { describe, expect, it, vi } from 'vitest';
import { type CacheEntry, createMemoryCacheProvider } from './cache';

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

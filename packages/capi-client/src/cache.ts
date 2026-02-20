export type CacheStrategy = 'cache-first' | 'network-first' | 'swr';

export interface CacheEntry {
  value: unknown;
  storedAt: number;
  ttlMs: number;
}

export interface CacheProvider {
  get: (key: string) => Promise<CacheEntry | undefined>;
  set: (key: string, entry: CacheEntry) => Promise<void>;
  flush: () => Promise<void>;
}

interface MemoryCacheProviderOptions {
  maxEntries?: number;
}

export const createMemoryCacheProvider = (
  options: MemoryCacheProviderOptions = {},
): CacheProvider => {
  const maxEntries = options.maxEntries ?? 1_000;
  const cache = new Map<string, CacheEntry>();

  return {
    async get(key: string) {
      const entry = cache.get(key);
      if (!entry) {
        return undefined;
      }

      if (Date.now() - entry.storedAt > entry.ttlMs) {
        cache.delete(key);
        return undefined;
      }

      return entry;
    },
    async set(key: string, entry: CacheEntry) {
      if (cache.has(key)) {
        cache.delete(key);
      }

      cache.set(key, entry);

      if (cache.size > maxEntries) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }
    },
    async flush() {
      cache.clear();
    },
  };
};

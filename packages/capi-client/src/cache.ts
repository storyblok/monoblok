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

export const createMemoryCacheProvider = (): CacheProvider => {
  const cache = new Map<string, CacheEntry>();

  return {
    async get(key: string) {
      return cache.get(key);
    },
    async set(key: string, entry: CacheEntry) {
      cache.set(key, entry);
    },
    async flush() {
      cache.clear();
    },
  };
};

export const isCacheEntryFresh = (storedAt: number, ttlMs: number) => Date.now() - storedAt <= ttlMs;

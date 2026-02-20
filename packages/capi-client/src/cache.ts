export type CacheStrategy = 'cache-first' | 'network-first' | 'swr';

interface StrategyContext<TData> {
  key: string;
  cachedResult: TData | undefined;
  loadNetwork: () => Promise<TData>;
}

export type CacheStrategyHandler = <TData>(context: StrategyContext<TData>) => Promise<TData>;

export interface CacheEntry {
  value: unknown;
  storedAt: number;
  ttlMs: number;
}

export interface CacheEntryInput {
  value: unknown;
  storedAt?: number;
  ttlMs: number;
}

export interface CacheProvider {
  get: (key: string) => Promise<CacheEntry | undefined>;
  set: (key: string, entry: CacheEntryInput) => Promise<void>;
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
    async set(key: string, entry: CacheEntryInput) {
      const cacheEntry: CacheEntry = {
        ...entry,
        storedAt: entry.storedAt ?? Date.now(),
      };

      if (cache.has(key)) {
        cache.delete(key);
      }

      cache.set(key, cacheEntry);

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

export const createCacheFirstStrategy = (): CacheStrategyHandler => {
  return async <TData>({ cachedResult, loadNetwork }: StrategyContext<TData>) => {
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    return loadNetwork();
  };
};

export const createNetworkFirstStrategy = (): CacheStrategyHandler => {
  return async <TData>({ cachedResult, loadNetwork }: StrategyContext<TData>) => {
    try {
      return await loadNetwork();
    }
    catch (error) {
      // network-first: try network, fall back to cached data if available.
      if (cachedResult !== undefined) {
        return cachedResult;
      }

      throw error;
    }
  };
};

export const createSwrStrategy = (): CacheStrategyHandler => {
  const revalidations = new Map<string, Promise<unknown>>();

  return async <TData>({ key, cachedResult, loadNetwork }: StrategyContext<TData>) => {
    if (cachedResult !== undefined) {
      if (!revalidations.has(key)) {
        const revalidation = loadNetwork()
          .catch(() => undefined)
          .finally(() => {
            revalidations.delete(key);
          });

        revalidations.set(key, revalidation);
      }

      return cachedResult;
    }

    return loadNetwork();
  };
};

export const createStrategy = (strategy: CacheStrategy): CacheStrategyHandler => {
  if (strategy === 'network-first') {
    return createNetworkFirstStrategy();
  }

  if (strategy === 'swr') {
    return createSwrStrategy();
  }

  return createCacheFirstStrategy();
};

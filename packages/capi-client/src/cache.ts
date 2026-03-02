export type CacheStrategy = 'cache-first' | 'network-first' | 'swr';

interface StrategyContext<TData> {
  key: string;
  cachedResult: TData | undefined;
  loadNetwork: () => Promise<TData>;
}

export type CacheStrategyHandler = <TData>(context: StrategyContext<TData>) => Promise<TData>;

export interface CacheEntry<TValue = unknown> {
  value: TValue;
  storedAt: number;
  ttlMs: number;
}

export interface CacheEntryInput<TValue = unknown> {
  value: TValue;
  storedAt?: number;
  ttlMs: number;
}

export interface CacheProvider {
  get: <TValue = unknown>(key: string) => Promise<CacheEntry<TValue> | undefined>;
  set: <TValue = unknown>(key: string, entry: CacheEntryInput<TValue>) => Promise<void>;
  flush: () => Promise<void>;
}

interface MemoryCacheProviderOptions {
  maxEntries?: number;
}

export const createMemoryCacheProvider = (
  options: MemoryCacheProviderOptions = {},
): CacheProvider => {
  const maxEntries = options.maxEntries ?? 1_000;
  const cache = new Map<string, CacheEntry<unknown>>();

  return {
    async get<TValue = unknown>(key: string) {
      const entry = cache.get(key) as CacheEntry<TValue>;
      if (!entry) {
        return undefined;
      }

      if (Date.now() - entry.storedAt > entry.ttlMs) {
        cache.delete(key);
        return undefined;
      }

      return entry;
    },
    async set<TValue = unknown>(key: string, entry: CacheEntryInput<TValue>) {
      const cacheEntry: CacheEntry<TValue> = {
        ...entry,
        storedAt: entry.storedAt ?? Date.now(),
      };

      // Move existing keys to the end so eviction stays LRU-like.
      // Map#set updates values in place and does not change insertion order.
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
    async flush(): Promise<void> {
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

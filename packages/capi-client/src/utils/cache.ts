export type CacheStrategy = "cache-first" | "network-first" | "swr";

interface StrategyContext<TData> {
  key: string;
  cachedResult: TData | undefined;
  loadNetwork: () => Promise<TData>;
  /**
   * Describes the failure a value `loadNetwork` resolved with represents, or `undefined`
   * when it succeeded.
   *
   * A failed request does not always reject: with `throwOnError` disabled — the default —
   * an HTTP error arrives as a resolved response carrying `error`. A strategy that reacts
   * to failure has to recognise those, and `network-first` also has to tell a temporary
   * failure apart from a definitive one.
   *
   * Optional: a context without it behaves as if every resolved value succeeded, so
   * custom strategy handlers and callers that do not supply it keep working.
   */
  getFailure?: (value: TData) => StrategyFailure | undefined;
}

export interface StrategyFailure {
  /** `true` for a failure worth retrying — an outage rather than an answer. */
  transient: boolean;
  /** The failure itself, for reporting. */
  error: unknown;
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
      // Map stores heterogeneous CacheEntry<unknown>; caller provides the expected type via the generic.
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

/**
 * Statuses that mean "try again later" rather than "here is your answer". Mirrors the set
 * the client retries, so one of these only reaches a strategy once the retries are spent
 * and the failure is a real outage.
 */
const TRANSIENT_STATUS_CODES = new Set([408, 413, 429]);

/** Returns `true` for a status that reflects a temporary failure rather than an answer. */
export const isTransientStatus = (status: number): boolean =>
  status >= 500 || TRANSIENT_STATUS_CODES.has(status);

export const createCacheFirstStrategy = (): CacheStrategyHandler => {
  return async <TData>({ cachedResult, loadNetwork }: StrategyContext<TData>) => {
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    return loadNetwork();
  };
};

export const createNetworkFirstStrategy = (): CacheStrategyHandler => {
  return async <TData>({ cachedResult, loadNetwork, getFailure }: StrategyContext<TData>) => {
    try {
      const result = await loadNetwork();

      // An HTTP error is a resolved value rather than a rejection unless `throwOnError`
      // is enabled, so falling back only in `catch` would miss the most common outage:
      // the origin answering 5xx. A transient failure is treated exactly like a thrown
      // network error. A definitive one — 404, 401 — is returned as it is: serving a
      // cached copy there would mask a deletion or a revoked token.
      if (cachedResult !== undefined && getFailure?.(result)?.transient === true) {
        return cachedResult;
      }

      return result;
    } catch (error) {
      // network-first: try network, fall back to cached data if available.
      if (cachedResult !== undefined) {
        return cachedResult;
      }

      throw error;
    }
  };
};

export interface SwrStrategyOptions {
  /** Called when a background revalidation fails. Defaults to `console.warn`. */
  onRevalidationError?: (error: unknown) => void;
}

const defaultOnRevalidationError = (error: unknown): void => {
  console.warn("[storyblok/api-client] SWR background revalidation failed:", error);
};

export const createSwrStrategy = (options: SwrStrategyOptions = {}): CacheStrategyHandler => {
  const { onRevalidationError = defaultOnRevalidationError } = options;
  const revalidations = new Map<string, Promise<unknown>>();

  return async <TData>({ key, cachedResult, loadNetwork, getFailure }: StrategyContext<TData>) => {
    if (cachedResult !== undefined) {
      if (!revalidations.has(key)) {
        const revalidation = loadNetwork()
          .then((value) => {
            // A revalidation that came back 5xx resolved rather than threw, so reporting
            // only from `catch` would drop it silently and leave the entry to go stale
            // with no signal at all. Every failure reaches the callback, transient or
            // not: the caller decides what is worth acting on.
            const failure = getFailure?.(value);
            if (failure !== undefined) {
              onRevalidationError(failure.error);
            }
          })
          .catch((error: unknown) => {
            onRevalidationError(error);
          })
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

export const createStrategy = (
  strategy: CacheStrategy,
  options?: SwrStrategyOptions,
): CacheStrategyHandler => {
  if (strategy === "network-first") {
    return createNetworkFirstStrategy();
  }

  if (strategy === "swr") {
    return createSwrStrategy(options);
  }

  return createCacheFirstStrategy();
};

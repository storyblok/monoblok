export const CACHEABLE_METHODS = new Set(['GET']);
export const NON_CACHEABLE_PATHS = new Set(['/v2/cdn/spaces/me']);

/** Returns `true` when the query targets draft content (`version: 'draft'`). Draft requests bypass the cache. */
export const isDraftRequest = (query: Record<string, unknown>) => query.version === 'draft';

/** Ensures a path always starts with a leading slash for consistent comparisons and cache keys. */
const normalizePath = (path: string) => path.startsWith('/') ? path : `/${path}`;

/**
 * Recursively normalizes query values by sorting object keys.
 * This makes JSON stringification deterministic for cache key generation.
 */
const normalizeQuery = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => normalizeQuery(item));
  }

  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      sorted[key] = normalizeQuery(val);
    }
    return sorted;
  }

  return value;
};

export const createCacheKey = (method: string, path: string, query: Record<string, unknown>) => {
  return JSON.stringify({
    method,
    path: normalizePath(path),
    query: normalizeQuery(query),
  });
};

/** Returns `false` for non-GET methods, the spaces endpoint, and draft requests — all of which bypass the cache. */
export const shouldUseCache = (method: string, path: string, query: Record<string, unknown>) => {
  return CACHEABLE_METHODS.has(method)
    && !NON_CACHEABLE_PATHS.has(normalizePath(path))
    && !isDraftRequest(query);
};

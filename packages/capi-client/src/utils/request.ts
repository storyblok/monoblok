export const CACHEABLE_METHODS = new Set(['GET']);
export const NON_CACHEABLE_PATHS = new Set(['/v2/cdn/spaces/me']);

export const isDraftRequest = (query: Record<string, unknown>) => query.version === 'draft';

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
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = normalizeQuery((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
};

export const createCacheKey = (method: string, path: string, query: Record<string, unknown>) => {
  return JSON.stringify({
    method,
    path,
    query: normalizeQuery(query),
  });
};

export const shouldUseCache = (method: string, path: string, query: Record<string, unknown>) => {
  return CACHEABLE_METHODS.has(method)
    && !NON_CACHEABLE_PATHS.has(path)
    && !isDraftRequest(query);
};

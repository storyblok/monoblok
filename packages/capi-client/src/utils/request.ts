const CDN_PATH_PREFIX = '/v2/cdn/';
export const CACHEABLE_METHODS = new Set(['GET']);
export const NON_CACHEABLE_PATHS = new Set(['/v2/cdn/spaces/me']);

export const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

export const isCdnPath = (path: string) => path.startsWith(CDN_PATH_PREFIX);

export const isDraftRequest = (query: Record<string, unknown>) => query.version === 'draft';

const normalizeQuery = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => normalizeQuery(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeQuery((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
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
    && isCdnPath(path)
    && !NON_CACHEABLE_PATHS.has(path)
    && !isDraftRequest(query);
};

export const toQueryRecord = <T extends Record<string, unknown>>(query: T | undefined): Record<string, unknown> => {
  return query ?? {};
};

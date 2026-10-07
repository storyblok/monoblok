import { sortKeysDeep } from "@storyblok/utils/serialization";

export const CACHEABLE_METHODS = new Set(["GET"]);

export const SPACES_ME_PATH = "/v2/cdn/spaces/me";

export const NON_CACHEABLE_PATHS = new Set([SPACES_ME_PATH]);

/** Returns `true` when the query targets draft content (`version: 'draft'`). Draft requests bypass the cache. */
export const isDraftRequest = (query: Record<string, unknown>) => query.version === "draft";

/**
 * Normalizes to exactly one leading slash and no trailing one, for comparisons and cache
 * keys. The API serves `/cdn/spaces/me/` like `/cdn/spaces/me`.
 */
export const normalizePath = (path: string) => {
  const withLeadingSlash = path.replace(/^\/*/, "/");
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
};

export const isSpacesMeRequest = (path: string) => normalizePath(path) === SPACES_ME_PATH;

/**
 * `tokenId` scopes the key to the space: the token travels outside `query`, so without it
 * clients for different spaces sharing a provider would read each other's content.
 */
export const createCacheKey = (
  method: string,
  path: string,
  query: Record<string, unknown>,
  tokenId: string,
) => {
  return JSON.stringify({
    method,
    path: normalizePath(path),
    query: sortKeysDeep(query),
    tokenId,
  });
};

/** Returns `false` for non-GET methods, the spaces endpoint, and draft requests — all of which bypass the cache. */
export const shouldUseCache = (method: string, path: string, query: Record<string, unknown>) => {
  return (
    CACHEABLE_METHODS.has(method) &&
    !NON_CACHEABLE_PATHS.has(normalizePath(path)) &&
    !isDraftRequest(query)
  );
};

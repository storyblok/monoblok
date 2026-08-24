import { isDraftRequest } from "./request";

/**
 * Whether a query carries a `cv` the caller chose, which is honoured literally: keyed by
 * itself, immune to publishes, never teaching a watermark.
 *
 * Only a positive `cv` is a version, here as everywhere: `0` is the sentinel
 * `storyblok-js-client` records for "no version known", so a caller carrying that idiom
 * over would otherwise pin every request to a `cv` the API redirects away from, under a
 * key nothing invalidates.
 */
export const isCvPinned = (value: unknown): boolean => Number(value) > 0;

/**
 * Reads the `cv` a response body reports — the snapshot it was actually served from.
 *
 * Only a positive `cv` is a version: the API redirects `cv=0` (like any `cv` the edge
 * does not hold) to the current snapshot, so adopting `0` as a watermark would put a
 * value on the wire that only ever costs an extra hop.
 */
export const extractCv = (maybeData: unknown) => {
  if (!maybeData || typeof maybeData !== "object" || !("cv" in maybeData)) {
    return undefined;
  }

  return typeof maybeData.cv === "number" && maybeData.cv > 0 ? maybeData.cv : undefined;
};

/**
 * Reads `space.version` from a `/cdn/spaces/me` response.
 *
 * Not a `cv`, and must never be sent as one: a Minimum Cache TTL floors the `cv` into
 * TTL-sized buckets while `space.version` reports the raw version. Change signal only.
 */
export const extractSpaceVersion = (maybeData: unknown) => {
  if (!maybeData || typeof maybeData !== "object" || !("space" in maybeData)) {
    return undefined;
  }

  const space = maybeData.space;
  if (!space || typeof space !== "object" || !("version" in space)) {
    return undefined;
  }

  return typeof space.version === "number" ? space.version : undefined;
};

export const applyCvToQuery = (query: Record<string, unknown>, cv: number) => {
  if (isDraftRequest(query)) {
    return query;
  }

  if (query.cv !== undefined) {
    return query;
  }

  return {
    ...query,
    cv,
  };
};

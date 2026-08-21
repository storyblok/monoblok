import { isDraftRequest } from "./request";

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

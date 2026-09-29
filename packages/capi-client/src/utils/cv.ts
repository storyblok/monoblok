import { isDraftRequest } from "./request";

/**
 * Whether the caller pinned a `cv`. Only a positive `cv` is a version: `storyblok-js-client`
 * uses `0` for "unknown", and treating it as a pin would key requests under a `cv` the API
 * redirects away from.
 */
export const isCvPinned = (value: unknown): boolean => Number(value) > 0;

/**
 * Reads the `cv` of the snapshot a response was served from. Non-positive values are
 * ignored: the API redirects `cv=0` like any `cv` the edge doesn't hold.
 */
export const extractCv = (maybeData: unknown) => {
  if (!maybeData || typeof maybeData !== "object" || !("cv" in maybeData)) {
    return undefined;
  }

  return typeof maybeData.cv === "number" && maybeData.cv > 0 ? maybeData.cv : undefined;
};

/**
 * Reads `space.version` from a `/cdn/spaces/me` response. A change signal only, never sent
 * as a `cv`: a Minimum Cache TTL floors the `cv` into buckets but not `space.version`.
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

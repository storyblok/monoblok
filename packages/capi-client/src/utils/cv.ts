import { isDraftRequest } from "./request";

export const extractCv = (maybeData: unknown) => {
  return maybeData && typeof maybeData === "object" && "cv" in maybeData
    ? typeof maybeData.cv === "number"
      ? maybeData.cv
      : undefined
    : undefined;
};

/**
 * Reads `space.version` from a `/cdn/spaces/me` response.
 *
 * This is *not* a `cv` and must never be sent as one: for tokens with a Minimum
 * Cache TTL the API floors the `cv` into TTL-sized buckets, while `space.version`
 * always reports the latest raw version. It is only useful as a change signal.
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

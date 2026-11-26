import { isDraftRequest, isStoriesRequest, shouldUseCache } from "./request";

/**
 * Whether the caller pinned a `cv`. Only a positive `cv` is a version: `storyblok-js-client`
 * uses `0` for "unknown", and treating it as a pin would key requests under a `cv` the API
 * redirects away from.
 */
export const isCvPinned = (value: unknown): boolean => Number(value) > 0;

/**
 * Reads the `cv` a response body reports. Non-positive values are ignored: the API
 * redirects `cv=0` like any `cv` the edge doesn't hold.
 */
export const extractCv = (maybeData: unknown) => {
  if (!maybeData || typeof maybeData !== "object" || !("cv" in maybeData)) {
    return undefined;
  }

  return typeof maybeData.cv === "number" && maybeData.cv > 0 ? maybeData.cv : undefined;
};

/** The CDN serves the last of several `cv` parameters, so that one names the snapshot. */
const extractCvFromUrl = (url: string | undefined) => {
  if (!url) {
    return undefined;
  }
  let cvs: string[];
  try {
    cvs = new URL(url).searchParams.getAll("cv");
  } catch {
    return undefined;
  }
  const cv = Number(cvs[cvs.length - 1]);
  return Number.isSafeInteger(cv) && cv > 0 ? cv : undefined;
};

/**
 * Reads the `cv` of the snapshot a response was served from: the body's or else the final
 * URL's. `/cdn/links` reports no body `cv`, so its URL is the only source: a request without
 * a `cv`, or with one the edge doesn't hold, is redirected to the current one. Only a
 * cacheable published request's URL names the served snapshot; draft and `/cdn/spaces/me`
 * URLs keep whatever `cv` the caller sent.
 *
 * The served snapshot isn't necessarily the current one, see `extractCurrentCv`.
 */
export const extractServedCv = (
  result: { data?: unknown; response?: Pick<Response, "url"> },
  request: { method: string; path: string; query: Record<string, unknown> },
) => {
  const bodyCv = extractCv(result.data);
  if (bodyCv !== undefined || !shouldUseCache(request.method, request.path, request.query)) {
    return bodyCv;
  }
  return extractCvFromUrl(result.response?.url);
};

/**
 * Reads the `cv` a cacheable published response proves current: the one its final URL carries
 * when that differs from the `cv` sent, which only an origin redirect to the current `cv` does.
 *
 * Not every endpoint is redirected in every space (`/cdn/tags` never is), and the edge answers
 * a request it doesn't redirect from whatever it cached for that URL, up to a week ago. So a
 * body `cv`, or a URL `cv` equal to the one sent, proves nothing. A `Response` rebuilt on its
 * way to the client has no URL; then a stories body `cv` counts, which is old only in a space
 * whose API doesn't redirect.
 */
export const extractCurrentCv = (
  result: { data?: unknown; response?: Pick<Response, "url"> },
  request: { method: string; path: string; query: Record<string, unknown> },
) => {
  if (!shouldUseCache(request.method, request.path, request.query)) {
    return undefined;
  }
  const url = result.response?.url;
  if (!url) {
    return isStoriesRequest(request.path) ? extractCv(result.data) : undefined;
  }
  const urlCv = extractCvFromUrl(url);
  return urlCv !== Number(request.query.cv) ? urlCv : undefined;
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

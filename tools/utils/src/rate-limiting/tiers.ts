/**
 * Requests per second the Content Delivery API allows, by tier. The tier is
 * set by how many entries a request asks for: single entries and listings of
 * up to 25 entries share the highest one.
 */
export const RATE_LIMIT_TIERS = {
  SINGLE_OR_SMALL: 50,
  MEDIUM: 15,
  LARGE: 10,
  VERY_LARGE: 6,
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

/** Largest `per_page` each tier covers; anything above `LARGE` is `VERY_LARGE`. */
const PER_PAGE_THRESHOLDS = {
  SMALL: 25,
  MEDIUM: 50,
  LARGE: 75,
} as const;

/** The `per_page` the API applies when a request omits it. */
const DEFAULT_PER_PAGE = 25;

/** Accepts any query object, including option interfaces without an index signature. */
type TierQuery = { readonly per_page?: unknown; readonly find_by?: unknown };

/** A story path with an identifier after it, nested slugs included. */
const SINGLE_STORY_PATH = /\/cdn\/stories\/.+$/;

/**
 * Whether a request fetches one story: by its slug, ID or UUID in the path, or
 * with `find_by`, which only applies to a single story fetch.
 */
function isSingleStoryRequest(path: string, query: TierQuery): boolean {
  return SINGLE_STORY_PATH.test(path) || "find_by" in query;
}

function toPerPage(value: unknown): number {
  const perPage =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isFinite(perPage) && perPage > 0 ? perPage : DEFAULT_PER_PAGE;
}

/** Maps a request path and query to the rate-limit tier the API applies to it. */
export function determineRateLimitTier(path: string, query: TierQuery): RateLimitTier {
  if (isSingleStoryRequest(path, query)) {
    return "SINGLE_OR_SMALL";
  }

  const perPage = toPerPage(query.per_page);
  if (perPage <= PER_PAGE_THRESHOLDS.SMALL) {
    return "SINGLE_OR_SMALL";
  }
  if (perPage <= PER_PAGE_THRESHOLDS.MEDIUM) {
    return "MEDIUM";
  }
  if (perPage <= PER_PAGE_THRESHOLDS.LARGE) {
    return "LARGE";
  }
  return "VERY_LARGE";
}

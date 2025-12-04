import type { ISbStoriesParams } from './interfaces';
import { DEFAULT_PER_PAGE, PER_PAGE_THRESHOLDS, StoryblokContentVersion } from './constants';

export interface RateLimitConfig {
  // User-provided rate limit (applies only to uncached requests)
  userRateLimit?: number;
  // Rate limit determined from server response headers
  serverHeadersRateLimit?: number;
  // Whether this is a Management API client (uses oauthToken)
  isManagementApi?: boolean;
}

export interface RateLimitHeaders {
  remaining?: number;
  max?: number;
}

/**
 * Rate limit tiers for uncached requests based on per_page parameter
 */
const UNCACHED_RATE_LIMITS = {
  SINGLE_OR_SMALL: 50, // Single entries or listings ≤25 entries
  MEDIUM: 15, // 26-50 entries
  LARGE: 10, // 51-75 entries
  VERY_LARGE: 6, // 76-100 entries
} as const;

/**
 * Maximum rate limit that should never be exceeded
 * Also used for cached requests (version=published or missing)
 */
const MAX_RATE_LIMIT = 1000;

/**
 * Default rate limit for Management API (when using oauthToken)
 */
export const MANAGEMENT_API_DEFAULT_RATE_LIMIT = 3;

/**
 * Determines if a request is uncached (draft version)
 */
function isUncachedRequest(params: ISbStoriesParams): boolean {
  return params.version === StoryblokContentVersion.DRAFT;
}

/**
 * Determines if a request is for a single story based on URL and params
 */
function isSingleStoryRequest(url: string, params: ISbStoriesParams): boolean {
  // Single story requests typically have a specific story slug/id in the URL
  // or use find_by parameter
  const isCdnStories = url.includes('/cdn/stories/');
  const hasSpecificPath = url.split('/').length > 3 && !url.endsWith('/cdn/stories');
  const hasFindBy = 'find_by' in params;

  return (isCdnStories && hasSpecificPath) || hasFindBy;
}

/**
 * Calculates the appropriate rate limit tier for uncached requests
 * based on the number of entries requested (per_page parameter)
 */
function getUncachedRateLimitTier(perPage: number): number {
  if (perPage <= PER_PAGE_THRESHOLDS.SMALL) {
    return UNCACHED_RATE_LIMITS.SINGLE_OR_SMALL;
  }
  else if (perPage <= PER_PAGE_THRESHOLDS.MEDIUM) {
    return UNCACHED_RATE_LIMITS.MEDIUM;
  }
  else if (perPage <= PER_PAGE_THRESHOLDS.LARGE) {
    return UNCACHED_RATE_LIMITS.LARGE;
  }
  else {
    return UNCACHED_RATE_LIMITS.VERY_LARGE;
  }
}

/**
 * Determines the appropriate rate limit for a request based on:
 * - Request version (cached vs uncached)
 * - Request type (single vs listing)
 * - Number of entries (per_page)
 * - User configuration
 * - Server headers
 *
 * When url and params are not provided (Management API), uses the defaultRateLimit
 * as the fallback instead of automatic tier calculation.
 */
export function determineRateLimit(
  url?: string,
  params?: ISbStoriesParams,
  config: RateLimitConfig = {},
  defaultRateLimit?: number,
): number {
  // Priority order for all requests:
  // 1. User-provided rate limit (highest priority, applies to all requests)
  // 2. Server-provided rate limit (from response headers)
  // 3. Default rate limit (Management API)
  // 4. For cached requests (published), use the maximum rate limit
  // 5. Automatic tier calculation (CDN)

  if (config.userRateLimit !== undefined) {
    return Math.min(config.userRateLimit, MAX_RATE_LIMIT);
  }

  if (config.serverHeadersRateLimit !== undefined) {
    return Math.min(config.serverHeadersRateLimit, MAX_RATE_LIMIT);
  }

  // If a default rate limit is provided (Management API), use it
  if (defaultRateLimit !== undefined) {
    return defaultRateLimit;
  }

  // For cached requests, use the maximum rate limit
  if (params && !isUncachedRequest(params)) {
    return MAX_RATE_LIMIT;
  }

  // For CDN API, calculate based on request type
  // At this point, url and params should be defined for CDN API calls
  // Single story requests or listings without per_page
  if (isSingleStoryRequest(url!, params!)) {
    return UNCACHED_RATE_LIMITS.SINGLE_OR_SMALL;
  }

  // For listings, determine tier based on per_page
  const perPage = params!.per_page || DEFAULT_PER_PAGE;
  return getUncachedRateLimitTier(perPage);
}

/**
 * Parses X-RateLimit and X-RateLimit-Policy headers from the response
 *
 * Example headers:
 * X-RateLimit: "concurrent-requests";r=29
 * X-RateLimit-Policy: "concurrent-requests";q=30
 *
 * Where:
 * - r = remaining requests
 * - q = maximum requests allowed (quota)
 */
export function parseRateLimitHeaders(headers: any): RateLimitHeaders | null {
  if (!headers) {
    return null;
  }

  const rateLimitHeader = headers['x-ratelimit'] || headers['X-RateLimit'];
  const rateLimitPolicyHeader = headers['x-ratelimit-policy'] || headers['X-RateLimit-Policy'];

  if (!rateLimitHeader && !rateLimitPolicyHeader) {
    return null;
  }

  const result: RateLimitHeaders = {};

  // Parse remaining from X-RateLimit header
  if (rateLimitHeader) {
    const remainingMatch = rateLimitHeader.match(/r=(\d+)/);
    if (remainingMatch) {
      result.remaining = Number.parseInt(remainingMatch[1], 10);
    }
  }

  // Parse max from X-RateLimit-Policy header
  if (rateLimitPolicyHeader) {
    const maxMatch = rateLimitPolicyHeader.match(/q=(\d+)/);
    if (maxMatch) {
      result.max = Number.parseInt(maxMatch[1], 10);
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Creates a rate limit configuration object
 */
export function createRateLimitConfig(userRateLimit?: number, isManagementApi = false): RateLimitConfig {
  return {
    userRateLimit,
    serverHeadersRateLimit: undefined,
    isManagementApi,
  };
}

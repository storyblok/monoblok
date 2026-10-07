import {
  determineRateLimitTier,
  MAX_RATE_LIMIT,
  parseRateLimitPolicy,
  RATE_LIMIT_TIERS,
} from "@storyblok/utils/rate-limiting";
import type { ISbStoriesParams } from "./interfaces";

export interface RateLimitConfig {
  // User-provided rate limit
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
 * Default rate limit for Management API (when using oauthToken)
 */
export const MANAGEMENT_API_DEFAULT_RATE_LIMIT = 3;

/**
 * Determines the appropriate rate limit for a request based on:
 * - Request type (single vs listing)
 * - Number of entries (per_page)
 * - User configuration
 * - Server headers
 *
 * Rate limits are based on per_page regardless of version (draft/published).
 * The backend enforces per_page-based rate limits on ALL requests before
 * checking the cache, so cached requests still count against rate limits.
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
  // 4. Automatic tier calculation based on per_page (CDN)

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

  // For CDN API, calculate based on request type and per_page
  // At this point, url and params should be defined for CDN API calls
  if (!url || !params) {
    return RATE_LIMIT_TIERS.SINGLE_OR_SMALL;
  }

  return RATE_LIMIT_TIERS[determineRateLimitTier(url, params)];
}

/**
 * Parses X-RateLimit and X-RateLimit-Policy headers from the response
 *
 * Example headers:
 * X-RateLimit: "concurrent-requests";r=29
 * X-RateLimit-Policy: "rate-limit";q=50;w=1
 *
 * `remaining` is the `r` of `X-RateLimit`. `max` is the per-second rate of the
 * strictest rate policy in `X-RateLimit-Policy`; a policy capping concurrent
 * requests states a count, not a rate, and never sets it.
 */
export function parseRateLimitHeaders(headers: any): RateLimitHeaders | null {
  if (!headers) {
    return null;
  }

  const rateLimitHeader = headers["x-ratelimit"] || headers["X-RateLimit"];
  const rateLimitPolicyHeader = headers["x-ratelimit-policy"] || headers["X-RateLimit-Policy"];

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
  const max = parseRateLimitPolicy(rateLimitPolicyHeader);
  if (max !== undefined) {
    result.max = max;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Creates a rate limit configuration object
 */
export function createRateLimitConfig(
  userRateLimit?: number,
  isManagementApi = false,
): RateLimitConfig {
  return {
    userRateLimit,
    serverHeadersRateLimit: undefined,
    isManagementApi,
  };
}

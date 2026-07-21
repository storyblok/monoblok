/**
 * Public API surface for `@storyblok/api-client`.
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 * This makes additions and removals from the public interface deliberate
 * and obvious in code review. Do not add `export *` statements here.
 */

// Client
// Rate limiting (deprecated)
// Kept for backwards compatibility with `0.x`. Rate limiting is configured via
// the `rateLimit` option on `createApiClient`; these standalone helpers are
// internal and will be removed in a future release. Declared as local aliases
// (not re-export specifiers) so the `@deprecated` JSDoc survives DTS bundling.
import {
  createThrottle as createThrottleInternal,
  parseRateLimitPolicyHeader as parseRateLimitPolicyHeaderInternal,
} from './utils/rate-limit';
import type { RateLimitConfig as RateLimitConfigInternal } from './utils/rate-limit';

export { createApiClient } from './client';
export type {
  ApiResponse,
  CacheConfig,
  ContentApiClient,
  ContentApiClientConfig,
  FetchOptions,
  HttpRequestMethod,
  HttpRequestOptions,
  RequestWithCacheOptions,
  ResourceDeps,
} from './client';

// Error
export { ClientError } from './error';
export type { ApiErrorBody } from './error';

// Generated client utilities
export type { Middleware } from './generated/capi/client/utils.gen';

export type {
  Datasource,
  DatasourceEntry,
  Link,
  StoryAlternate,
  Tag,
} from './generated/capi/types-aliased.gen';

export type {
  Space,
  StoryLocalizedPath,
  StoryTranslatedSlug,
} from './generated/mapi/types.gen';

// Domain types
export type { Block as Component } from './generated/types/block';
export type { Story } from './generated/types/story';
// Resource types
export type { StoryWithInlinedRelations } from './resources/stories';
// Cache types
export type { CacheProvider, CacheStrategy, CacheStrategyHandler } from './utils/cache';

/** @deprecated Configure rate limiting via `createApiClient({ rateLimit })`. Will be removed in a future release. */
export const createThrottle = createThrottleInternal;
/** @deprecated Configure rate limiting via `createApiClient({ rateLimit })`. Will be removed in a future release. */
export const parseRateLimitPolicyHeader = parseRateLimitPolicyHeaderInternal;
/** @deprecated Configure rate limiting via `createApiClient({ rateLimit })`. Will be removed in a future release. */
export type RateLimitConfig = RateLimitConfigInternal;

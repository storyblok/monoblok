/**
 * Public API surface for `@storyblok/api-client`.
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 * This makes additions and removals from the public interface deliberate
 * and obvious in code review. Do not add `export *` statements here.
 */

// Client
export { createApiClient } from "./client";
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
} from "./client";

// Error
export { ClientError, PaginationError } from "./error";
export type { ApiErrorBody, PaginationFailureReason } from "./error";

// Generated client utilities
export type { Middleware } from "./generated/capi/client/utils.gen";

export type {
  Datasource,
  DatasourceEntry,
  Link,
  StoryAlternate,
  Tag,
} from "./generated/capi/types-aliased.gen";

export type { Space, StoryLocalizedPath, StoryTranslatedSlug } from "./generated/mapi/types.gen";

export type { StrataErrorResponse, StrataSearchHit } from "./generated/capi/types.gen";

// Domain types
export type { Block as Component } from "./generated/types/block";
export type { Story } from "./generated/types/story";
// Resource types
export type {
  ExcludableStoryField,
  InlinedContentOptions,
  StoryWithInlinedLinks,
  StoryWithInlinedRelations,
  WithInlinedContent,
  WithInlinedLinks,
  WithInlinedRelations,
} from "./resources/stories";
export type { StrataSearchQuery } from "./resources/strata";
export type { InlinedLink, InlinedMultilinkValue } from "./utils/inline-links";
// Pagination types
export type { PageResult } from "./utils/paginate";
// Cache types
export type {
  CacheEntry,
  CacheEntryInput,
  CacheProvider,
  CacheStrategy,
  CacheStrategyHandler,
} from "./utils/cache";

// Rate limiting
export { createDefaultRateLimiter } from "./utils/limiter";
export type {
  AdaptiveConfig,
  CacheAwareConfig,
  DefaultRateLimiterOptions,
  RateLimitContext,
  RateLimiter,
  RateLimitStatus,
} from "./utils/limiter";
// The stock `CacheAwareConfig.detectCacheHit` and `DefaultRateLimiterOptions.parseServerLimit`,
// so a caller assembling its own limiter does not have to reimplement them.
export { parseCacheStatusHeader, parseRateLimitPolicyHeader } from "./utils/rate-limit";
export type { RateLimitConfig } from "./utils/rate-limit";

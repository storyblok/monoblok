/**
 * Public API surface for `@storyblok/api-client`.
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 * This makes additions and removals from the public interface deliberate
 * and obvious in code review. Do not add `export *` statements here.
 */

// Client
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

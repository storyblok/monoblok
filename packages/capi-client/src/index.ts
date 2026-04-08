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

// Generated types
export type { Middleware } from './generated/shared/client/utils.gen';

// Resource types
export type { StoryWithInlinedRelations } from './resources/stories';

// Cache types
export type { CacheProvider, CacheStrategy, CacheStrategyHandler } from './utils/cache';

// Domain types from @storyblok/schema
export type {
  Block as Component,
  Datasource,
  DatasourceEntry,
  Link,
  Space,
  Story,
  StoryAlternate,
  StoryLocalizedPath,
  StoryTranslatedSlug,
  Tag,
} from '@storyblok/schema';

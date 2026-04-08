/**
 * Public API surface for `@storyblok/management-api-client`.
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 * This makes additions and removals from the public interface deliberate
 * and obvious in code review. Do not add `export *` statements here.
 */

// Client
export { createManagementApiClient } from './client';
export type {
  ApiResponse,
  FetchOptions,
  HttpRequestOptions,
  ManagementApiClient,
  ManagementApiClientConfig,
  MapiResourceDeps,
  RequestConfigOverrides,
} from './client';
export { ClientError } from './error';
export type { ApiErrorBody } from './error';

// MAPI endpoint-specific types
export type { AssetSignRequest, AssetUpdateRequest, SignedResponseObject } from './generated/assets/types.gen';
export type { ComponentSchemaField } from './generated/components/types.gen';
export type { AssetListQuery } from './resources/assets';
export type { AssetCreate as AssetUploadRequest } from './resources/assets';
export type { StoryListQuery } from './resources/stories';

// Utilities
export { normalizeAssetUrl } from './utils/normalize-asset-url';

// Rate limit config
export type { RateLimitConfig } from './utils/rate-limit';

// Domain types from @storyblok/schema (shared CAPI + MAPI)
export type {
  AssetFieldValue,
  Block as Component,
  BlockContent as BlokContent,
  BlocksFieldValue as BloksFieldValue,
  MultilinkFieldValue,
  PluginFieldValue,
  RichtextFieldValue,
  StoryAlternate,
  StoryLocalizedPath,
  StoryTranslatedSlug,
  TableFieldValue,
} from '@storyblok/schema';

// Domain types: single source of truth in @storyblok/schema/mapi
export type {
  Asset,
  AssetCreate,
  AssetFolder,
  AssetFolderCreate,
  AssetFolderUpdate,
  AssetUpdate,
  BlockContentInput as BlokContentInput,
  ComponentCreate,
  ComponentFolder,
  ComponentFolderCreate,
  ComponentFolderUpdate,
  ComponentUpdate,
  Datasource,
  DatasourceCreate,
  DatasourceEntry,
  DatasourceEntryCreate,
  DatasourceEntryUpdate,
  DatasourceUpdate,
  InternalTag,
  InternalTagCreate,
  InternalTagUpdate,
  Preset,
  PresetCreate,
  PresetUpdate,
  Space,
  SpaceCreate,
  SpaceUpdate,
  Story,
  StoryCreate,
  StoryUpdate,
  User,
  UserUpdate,
} from '@storyblok/schema/mapi';

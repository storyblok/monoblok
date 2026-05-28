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

// MAPI-only endpoint-specific types (raw SDK types).
export type {
  AssetUpdateRequest,
  CreateAsset as SignedResponseObject,
} from './generated/mapi/types.gen';
export type {
  Asset,
  AssetCreate,
  AssetFolder,
  AssetFolderCreate,
  AssetFolderUpdate,
  AssetUpdate,
  ComponentFolder,
  ComponentFolderCreate,
  ComponentFolderUpdate,
  DatasourceCreate,
  DatasourceUpdate,
  InternalTag,
  InternalTagCreate,
  InternalTagUpdate,
  MapiDatasource as Datasource,
  MapiDatasourceEntry as DatasourceEntry,
  Preset,
  PresetCreate,
  PresetUpdate,
  Space,
  SpaceCreate,
  SpaceUpdate,
  StoryLocalizedPath,
  StoryTranslatedSlug,
  User,
  UserUpdate,
} from './generated/mapi/types-aliased.gen';

export type { ComponentSchemaField } from './generated/overlay/types.gen';
// Domain types — sourced from the codegen tool's aliased + wrapper outputs.
export type {
  Block as Component,
  ComponentCreate,
  ComponentUpdate,
  RootBlocks as RootComponents,
} from './generated/types/block';

export type {
  AssetFieldValue,
  BlockContent as BlokContent,
  BlockContentInput as BlokContentInput,
  BlocksFieldValue as BloksFieldValue,
  MultilinkFieldValue,
  PluginFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from './generated/types/field';

export type {
  MapiStory as Story,
  StoryCreate,
  StoryUpdate,
} from './generated/types/mapi-story';

// Resource-defined helpers
export type { AssetCreate as AssetUploadRequest, AssetListQuery } from './resources/assets';
export type { StoryListQuery } from './resources/stories';
// Utilities
export { normalizeAssetUrl } from './utils/normalize-asset-url';
// Rate limit config
export type { RateLimitConfig } from './utils/rate-limit';

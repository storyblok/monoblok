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
  SpaceDetail,
} from './generated/mapi/types.gen';
export type {
  Asset,
  AssetCreate,
  AssetFolder,
  AssetFolderCreate,
  AssetFolderUpdate,
  AssetUpdate,
  Component,
  ComponentCreate,
  ComponentFolder,
  ComponentFolderCreate,
  ComponentFolderUpdate,
  ComponentUpdate,
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

// Domain types — sourced from the codegen tool's aliased + wrapper outputs.
// `Component` is the wire-shaped component *definition* (see the aliased export
// above); `RootComponents` is the DSL root-block helper used for story content.
export type {
  RootBlock as RootComponents,
} from './generated/types/block';
export type { Field } from './generated/types/field';

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
export type { AccessLevel, AssetFolderAccess, SharedAssetFolder, SharedAssetFolderCreate, SharedAssetFolderGetResponse, SharedAssetFolderListResponse, SharedAssetFolderUpdate } from './resources/shared-asset-folders';
export type { SharedAssetCreate, SharedAssetListQuery, SharedAssetListResponse, SharedAssetUploadRequest } from './resources/shared-assets';
export type { SharedInternalTag, SharedInternalTagCreate, SharedInternalTagListQuery, SharedInternalTagListResponse, SharedInternalTagMutateResponse, SharedInternalTagObjectType } from './resources/shared-internal-tags';
export type { SpaceCreateQuery } from './resources/spaces';
export type { StoryListQuery } from './resources/stories';
// Utilities
export { normalizeAssetUrl } from './utils/normalize-asset-url';
// Rate limit config
export type { RateLimitConfig } from './utils/rate-limit';

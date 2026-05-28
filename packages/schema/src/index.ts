/**
 * Public API surface for `@storyblok/schema`.
 *
 * CDN (CAPI) helpers use the bare name (e.g. `defineStory`).
 * MAPI-specific helpers use the `Mapi` prefix where a CDN helper with the same name exists
 * (e.g. `defineMapiStory`, `defineMapiAsset`, `defineMapiDatasourceEntry`).
 * MAPI-only helpers (no CDN counterpart) keep the bare name (e.g. `defineBlockFolder`).
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 */

// Shared / story helpers
export { createStoryHelpers } from './helpers/create-story-helpers';

// Asset
export { defineAssetCreate, defineAssetUpdate, defineMapiAsset } from './helpers/define-asset';
export type { AssetCreate, AssetUpdate, MapiAsset } from './helpers/define-asset';

// Asset folder (MAPI-only)
export { defineAssetFolder, defineAssetFolderCreate, defineAssetFolderUpdate } from './helpers/define-asset-folder';
export type { AssetFolder, AssetFolderCreate, AssetFolderUpdate } from './helpers/define-asset-folder';

// Block
export { defineBlock, defineBlockCreate, defineBlockUpdate } from './helpers/define-block';
export type { Block, BlockSchema, ComponentCreate, ComponentUpdate, NestableBlocks, RootBlocks } from './helpers/define-block';

// Block folder (MAPI-only)
export { defineBlockFolder, defineBlockFolderCreate, defineBlockFolderUpdate } from './helpers/define-block-folder';
export type { ComponentFolder, ComponentFolderCreate, ComponentFolderUpdate } from './helpers/define-block-folder';

// Datasource
export { defineDatasource, defineDatasourceCreate, defineDatasourceUpdate } from './helpers/define-datasource';
export type { Datasource, DatasourceCreate, DatasourceUpdate } from './helpers/define-datasource';

// Datasource entry
export { defineDatasourceEntry, defineDatasourceEntryCreate, defineDatasourceEntryUpdate, defineMapiDatasourceEntry } from './helpers/define-datasource-entry';
export type { DatasourceEntry, DatasourceEntryCreate, DatasourceEntryUpdate, MapiDatasourceEntry } from './helpers/define-datasource-entry';

// Field
export { defineField } from './helpers/define-field';
export type { AssetFieldValue, BlockContent, BlockContentInput, BlocksFieldValue, Field, FieldType, FieldValue, FieldValueInput, MultilinkFieldValue, PluginFieldValue, RichtextFieldValue, TableFieldValue } from './helpers/define-field';

// Internal tag (MAPI-only)
export { defineInternalTag, defineInternalTagCreate, defineInternalTagUpdate } from './helpers/define-internal-tag';
export type { InternalTag, InternalTagCreate, InternalTagUpdate } from './helpers/define-internal-tag';

// Link (CDN-only)
export { defineLink } from './helpers/define-link';
export type { Link } from './helpers/define-link';

// Preset (MAPI-only)
export { definePreset, definePresetCreate, definePresetUpdate } from './helpers/define-preset';
export type { Preset, PresetCreate, PresetUpdate } from './helpers/define-preset';

// Space (MAPI — no CDN Space endpoint)
export { defineSpace, defineSpaceCreate, defineSpaceUpdate } from './helpers/define-space';
export type { Space, SpaceCreate, SpaceUpdate } from './helpers/define-space';

// Story
export { defineMapiStory, defineStory, defineStoryCreate, defineStoryUpdate } from './helpers/define-story';
export type { MapiStory, Story, StoryAlternate, StoryBlock, StoryCreate, StoryLocalizedPath, StoryTranslatedSlug, StoryUpdate } from './helpers/define-story';

// Tag (CDN-only)
export { defineTag } from './helpers/define-tag';
export type { Tag } from './helpers/define-tag';

// User (MAPI-only)
export { defineUser, defineUserUpdate } from './helpers/define-user';
export type { User, UserUpdate } from './helpers/define-user';

// Schema type helpers
export type { Schema } from './helpers/schema-type';

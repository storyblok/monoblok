import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetListQuery, AssetUpdate } from '../../types';
import type { AssetUploadRequest } from '@storyblok/management-api-client';

export type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetListQuery, AssetUpdate };

/**
 * CLI extension of mapi-client's AssetUploadRequest.
 * Uses `AssetUploadRequest` (which combines `AssetUpdate` metadata fields with
 * `short_filename` for uploads) rather than the schema `AssetCreate` (which has
 * `filename`). Adds an optional `id` field used for manifest-based local↔remote
 * ID mapping. The `id` is stripped before the mapi-client create/upload call.
 */
export type AssetUpload = AssetUploadRequest & { id?: number };

export type AssetMapped = Pick<Asset, 'id' | 'filename' | 'alt' | 'title' | 'copyright' | 'source' | 'is_private' | 'meta_data'>;

/**
 * Maps local with remote asset ids and filenames.
 */
export type AssetMap = Map<number, { old: Asset | AssetMapped | AssetUpload; new: AssetMapped }>;

/**
 * Maps local with remote asset folder ids.
 */
export type AssetFolderMap = Map<number, number>;

/**
 * Maps local with remote story ids and UUIDs.
 */
export interface StoryMap extends Map<string | number, string | number> {
  get: ((key: number) => number | undefined) & ((key: string) => string | undefined);
  set: ((key: number, value: number) => this) & ((key: string, value: string) => this);
}

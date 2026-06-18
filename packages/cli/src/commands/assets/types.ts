import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetListQuery, AssetUpdate } from '../../types';
import type { AssetUploadRequest } from '@storyblok/management-api-client';

export type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetListQuery, AssetUpdate };

/**
 * CLI upload payload. Extends mapi-client's `AssetUploadRequest` (which carries
 * `short_filename` — the name the API uploads the file under) with the local
 * asset's identity: `id` and `filename` are kept only for manifest-based
 * local↔remote mapping and are ignored by the create/upload call.
 * `internal_tags_list` is the server-managed (read-only) tag detail carried in
 * pulled sidecars; it is used to translate source-space tag names to
 * target-space IDs and is stripped before the create/upload call.
 */
export type AssetUpload = AssetUploadRequest & { id?: number; filename?: string; internal_tags_list?: Asset['internal_tags_list'] };

export type AssetMapped = Partial<Pick<Asset, 'alt' | 'title' | 'copyright' | 'source' | 'is_private' | 'meta_data'>> & Pick<Asset, 'id' | 'filename'>;

/**
 * Maps local with remote asset ids and filenames.
 */
export type AssetMap = Map<number, { old: Asset | AssetMapped | AssetUpload; new: AssetMapped }>;

/**
 * Maps local with remote asset folder ids.
 */
export type AssetFolderMap = Map<number, number>;

/**
 * Maps target-space asset internal tag names to target-space ids.
 */
export type AssetInternalTagsByName = ReadonlyMap<string, number>;

export interface UnmappedAssetInternalTag {
  sourceId: number;
  name?: string;
}

/**
 * Maps local with remote story ids and UUIDs.
 */
export interface StoryMap extends Map<string | number, string | number> {
  get: ((key: number) => number | undefined) & ((key: string) => string | undefined);
  set: ((key: number, value: number) => this) & ((key: string, value: string) => this);
}

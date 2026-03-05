import type { Asset as MapiAsset } from '@storyblok/management-api-client';

export type Asset = MapiAsset;

/**
 * Fields the user can provide when creating a new asset. Server-assigned
 * readonly fields (`space_id`, `created_at`, etc.) are excluded.
 */
export type AssetCreate = Required<Pick<Asset, 'short_filename'>> & Omit<Asset, 'id' | 'filename' | 'space_id' | 'created_at' | 'updated_at' | 'content_type' | 'content_length' | 'short_filename'>;

export type AssetUpdate = Required<Pick<Asset, 'id' | 'filename'>> & Partial<Asset>;

export interface AssetUpload {
  id?: number;
  asset_folder_id?: number;
  short_filename: string;
  alt?: string;
  title?: string;
  copyright?: string;
  source?: string;
  is_private?: boolean;
}

export interface AssetMapped {
  id: number;
  filename: string;
  alt?: string;
  title?: string;
  copyright?: string;
  source?: string;
  is_private?: boolean;
  meta_data?: Record<string, any>;
}

/**
 * Maps local with remote asset ids and filenames.
 */
export type AssetMap = Map<number, { old: Asset | AssetMapped | AssetUpload; new: AssetMapped }>;

export interface AssetFolder {
  id: number;
  uuid: string;
  name: string;
  parent_id?: number | null;
  parent_uuid?: string | null;
}

export interface AssetFolderCreate {
  name: string;
  parent_id?: number | null;
}

export interface AssetFolderUpdate extends AssetFolderCreate {
  id: number;
}

/**
 * Maps local with remote asset folder ids.
 */
export type AssetFolderMap = Map<number, number>;

export interface AssetsQueryParams {
  page?: number;
  per_page?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Maps local with remote story ids and UUIDs.
 */
export interface StoryMap extends Map<string | number, string | number> {
  get: ((key: number) => number | undefined) & ((key: string) => string | undefined);
  set: ((key: number, value: number) => this) & ((key: string, value: string) => this);
}

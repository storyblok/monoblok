import type { Asset as MapiAsset } from '@storyblok/management-api-client/resources/assets';

export type Asset = Required<Pick<MapiAsset, 'id' | 'filename'>> & MapiAsset;

export type AssetCreate = Required<Pick<Asset, 'short_filename'>> & Omit<Asset, 'id' | 'filename'>;

export type AssetUpdate = Required<Pick<Asset, 'id' | 'filename'>> & Partial<Asset>;

export interface AssetUpload {
  id?: number;
  asset_folder_id?: number;
  short_filename: string;
}

/**
 * Maps local with remote asset ids and filenames.
 */
export interface AssetMap extends Map<string | number, string | number> {
  get: ((key: number) => number | undefined) & ((key: string) => string | undefined);
  set: ((key: number, value: number) => this) & ((key: string, value: string) => this);
}

export interface AssetFolder {
  id: number;
  uuid: string;
  name: string;
  parent_id?: number;
  parent_uuid?: string;
}

export interface AssetFolderCreate {
  name: string;
  parent_id?: number;
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

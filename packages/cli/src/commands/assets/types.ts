import type { Asset as MapiAsset } from '@storyblok/management-api-client/resources/assets';

export type Asset = Required<Pick<MapiAsset, 'id' | 'filename'>> & MapiAsset;

export type AssetCreate = Required<Pick<Asset, 'short_filename'>> & Omit<Asset, 'id' | 'filename'>;

export type AssetUpdate = Required<Pick<Asset, 'id' | 'filename'>> & Partial<Asset>;

export interface AssetUpload {
  id?: number;
  asset_folder_id?: number;
  short_filename: string;
}

export interface AssetFolder {
  id: number;
  uuid: string;
  name: string;
  parent_id: number | null;
  parent_uuid: string | null;
}

export interface AssetFolderCreate {
  name: string;
  parent_id?: number;
}

export interface AssetFolderUpdate extends AssetFolderCreate {
  id: number;
}

export interface AssetsQueryParams {
  page?: number;
  per_page?: number;
  [key: string]: string | number | boolean | undefined;
}

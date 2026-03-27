import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetUpdate } from '../types/asset';

const ASSET_DEFAULTS = {
  id: 1,
  filename: '',
  space_id: 1,
  created_at: '',
  updated_at: '',
  short_filename: '',
  content_type: '',
  content_length: 0,
};

const ASSET_FOLDER_DEFAULTS = {
  id: 1,
  uuid: '',
};

type AssetInput = { filename: string } & Partial<Omit<Asset, 'filename'>>;
type AssetFolderInput = { name: string } & Partial<Omit<AssetFolder, 'name'>>;

/**
 * Defines an asset for the MAPI.
 * `filename` is required; API-assigned fields (`id`, `space_id`, `created_at`, `updated_at`,
 * `short_filename`, `content_type`, `content_length`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineAsset } from '@storyblok/schema/mapi';
 * const asset = defineAsset({ filename: 'hero.png' });
 */
export const defineAsset = (asset: AssetInput): Asset => ({
  ...ASSET_DEFAULTS,
  ...asset,
});

/**
 * Defines an asset folder for the MAPI.
 * API-assigned fields (`id`, `uuid`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineAssetFolder } from '@storyblok/schema/mapi';
 * const folder = defineAssetFolder({ name: 'Images' });
 */
export const defineAssetFolder = (assetFolder: AssetFolderInput): AssetFolder => ({
  ...ASSET_FOLDER_DEFAULTS,
  ...assetFolder,
});

/**
 * Defines an asset creation payload for the MAPI upload flow.
 *
 * @example
 * import { defineAssetCreate } from '@storyblok/schema/mapi';
 * const payload = defineAssetCreate({ filename: 'hero.png', alt: 'Hero image' });
 */
export const defineAssetCreate = (asset: AssetCreate): AssetCreate => asset;

/**
 * Defines an asset update payload for the MAPI.
 *
 * @example
 * import { defineAssetUpdate } from '@storyblok/schema/mapi';
 * const payload = defineAssetUpdate({ alt: 'Updated hero image' });
 */
export const defineAssetUpdate = (asset: AssetUpdate): AssetUpdate => asset;

/**
 * Defines an asset folder creation payload for the MAPI.
 *
 * @example
 * import { defineAssetFolderCreate } from '@storyblok/schema/mapi';
 * const payload = defineAssetFolderCreate({ name: 'Images' });
 */
export const defineAssetFolderCreate = (assetFolder: AssetFolderCreate): AssetFolderCreate => assetFolder;

/**
 * Defines an asset folder update payload for the MAPI.
 *
 * @example
 * import { defineAssetFolderUpdate } from '@storyblok/schema/mapi';
 * const payload = defineAssetFolderUpdate({ name: 'Updated Images' });
 */
export const defineAssetFolderUpdate = (assetFolder: AssetFolderUpdate): AssetFolderUpdate => assetFolder;

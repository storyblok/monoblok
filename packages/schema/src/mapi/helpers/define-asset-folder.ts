import type { AssetFolder, AssetFolderCreate, AssetFolderUpdate } from '../../generated/mapi-types';

const ASSET_FOLDER_DEFAULTS = {
  id: 1,
  uuid: '',
};

export type { AssetFolder, AssetFolderCreate, AssetFolderUpdate };

type AssetFolderInput = { name: string } & Partial<Omit<AssetFolder, 'name'>>;

/**
 * Defines an asset folder.
 *
 * @example
 * const folder = defineAssetFolder({ name: 'Images' });
 */
export const defineAssetFolder = (assetFolder: AssetFolderInput): AssetFolder => ({
  ...ASSET_FOLDER_DEFAULTS,
  ...assetFolder,
});

/**
 * Defines an asset folder creation payload.
 *
 * @example
 * const payload = defineAssetFolderCreate({ name: 'Images' });
 */
export const defineAssetFolderCreate = (assetFolder: AssetFolderCreate): AssetFolderCreate => assetFolder;

/**
 * Defines an asset folder update payload.
 *
 * @example
 * const payload = defineAssetFolderUpdate({ name: 'Updated Images' });
 */
export const defineAssetFolderUpdate = (assetFolder: AssetFolderUpdate): AssetFolderUpdate => assetFolder;

import type { AssetFolder, AssetFolderCreate, AssetFolderUpdate } from '../generated/mapi/types.gen';

const ASSET_FOLDER_DEFAULTS = {
  id: 1,
  parent_id: null,
  parent_uuid: null,
};

export type { AssetFolder, AssetFolderCreate, AssetFolderUpdate };

type AssetFolderInput = { name: string } & Partial<Omit<AssetFolder, 'name'>>;

/**
 * Defines an asset folder.
 * When `uuid` is not provided, it defaults to the folder name
 * (prefixed by `parent_uuid/` for nested folders).
 *
 * @example
 * const folder = defineAssetFolder({ name: 'Images' });
 * // folder.uuid === 'Images'
 */
export const defineAssetFolder = (assetFolder: AssetFolderInput): AssetFolder => {
  const uuid = assetFolder.uuid
    || (assetFolder.parent_uuid ? `${assetFolder.parent_uuid}/${assetFolder.name}` : assetFolder.name);

  return {
    ...ASSET_FOLDER_DEFAULTS,
    ...assetFolder,
    parent_id: assetFolder.parent_id ?? ASSET_FOLDER_DEFAULTS.parent_id,
    parent_uuid: assetFolder.parent_uuid ?? ASSET_FOLDER_DEFAULTS.parent_uuid,
    uuid,
  };
};

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

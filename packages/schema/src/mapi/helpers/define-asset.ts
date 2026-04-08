import type { Asset, AssetCreate, AssetUpdate } from '../../generated/mapi-types';

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

export type { Asset, AssetCreate, AssetUpdate };

type AssetInput = { filename: string } & Partial<Omit<Asset, 'filename'>>;

/**
 * Defines an asset.
 *
 * @example
 * const asset = defineAsset({ filename: 'hero.png' });
 */
export const defineAsset = (asset: AssetInput): Asset => ({ ...ASSET_DEFAULTS, ...asset });

/**
 * Defines an asset creation payload upload flow.
 *
 * @example
 * const payload = defineAssetCreate({ filename: 'hero.png', alt: 'Hero image' });
 */
export const defineAssetCreate = (asset: AssetCreate): AssetCreate => asset;

/**
 * Defines an asset update payload.
 *
 * @example
 * const payload = defineAssetUpdate({ alt: 'Updated hero image' });
 */
export const defineAssetUpdate = (asset: AssetUpdate): AssetUpdate => asset;

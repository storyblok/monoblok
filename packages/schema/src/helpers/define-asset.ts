import type { Asset, AssetCreate, AssetUpdate } from '../generated/mapi-types';

const MAPI_ASSET_DEFAULTS = {
  id: 1,
  filename: '',
  space_id: 1,
  created_at: '',
  updated_at: '',
  short_filename: '',
  content_type: '',
  content_length: 0,
};

export type MapiAsset = Asset;
export type { AssetCreate, AssetUpdate };

type MapiAssetInput = { filename: string } & Partial<Omit<Asset, 'filename'>>;

/**
 * Defines a MAPI asset (standalone asset entity).
 * For asset fields embedded in story content, use {@link AssetFieldValue} instead.
 *
 * @example
 * const asset = defineMapiAsset({ filename: 'hero.png' });
 */
export const defineMapiAsset = (asset: MapiAssetInput): MapiAsset => ({ ...MAPI_ASSET_DEFAULTS, ...asset });

/**
 * Defines an asset creation payload for the upload flow.
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

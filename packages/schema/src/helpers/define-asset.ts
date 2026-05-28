import type { Asset, AssetCreate, AssetUpdate } from '../generated/mapi/types.gen';

const MAPI_ASSET_DEFAULTS = {
  id: 1,
  filename: '',
  space_id: 1,
  short_filename: '',
  created_at: '',
  updated_at: '',
  content_type: null,
  content_length: null,
  alt: null,
  asset_folder_id: null,
  copyright: null,
  expire_at: null,
  focus: null,
  is_private: false,
  title: null,
  deleted_at: null,
  publish_at: null,
  permanently_deleted: null,
  ext_id: null,
  source: null,
  locked: false,
  meta_data: null,
  file: null,
  internal_tag_ids: [],
  internal_tags_list: [],
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

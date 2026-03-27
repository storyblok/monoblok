import type { Asset } from '../types/asset';

/** Fields that are assigned by the API and can be omitted when defining an asset. */
type AssetApiAssigned = 'id' | 'space_id' | 'created_at' | 'updated_at' | 'short_filename' | 'content_type' | 'content_length';

/**
 * Input type for `defineAsset` — all API-assigned fields are optional.
 * The output type (`Asset`) still includes all fields.
 */
type AssetInput = Omit<Asset, AssetApiAssigned> & Partial<Pick<Asset, AssetApiAssigned>>;

const ASSET_DEFAULTS = {
  id: 1,
  space_id: 0,
  created_at: '',
  updated_at: '',
  short_filename: '',
  content_type: '',
  content_length: 0,
};

/**
 * Defines an asset object with type safety.
 * API-assigned fields (`id`, `space_id`, `created_at`, `updated_at`,
 * `short_filename`, `content_type`, `content_length`) are optional and default
 * to safe placeholder values.
 *
 * @example
 * const myAsset = defineAsset({ filename: 'https://a.storyblok.com/f/1/image.png' });
 */
export const defineAsset = (asset: AssetInput): Asset => ({
  ...ASSET_DEFAULTS,
  ...asset,
});

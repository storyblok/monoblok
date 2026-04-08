import type { Asset } from '../generated/types';
import type { Prettify } from '../utils/prettify';

const ASSET_DEFAULTS = {
  id: 1,
  space_id: 0,
  created_at: '',
  updated_at: '',
  short_filename: '',
  content_type: '',
  content_length: 0,
};

export type { Asset };

/** Fields that have safe defaults and may be omitted from asset input. */
type AssetOptional = keyof typeof ASSET_DEFAULTS;

type AssetInput = Prettify<Omit<Asset, AssetOptional> & Partial<Pick<Asset, AssetOptional>>>;

/**
 * Returns a full {@link Asset} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const myAsset = defineAsset({
 *   filename: 'https://a.storyblok.com/f/1/image.png'
 * });
 */
// Overload: provides the strict public signature for callers.
export function defineAsset(asset: AssetInput): Asset;

// Implementation signature: uses a loose parameter type because
// TypeScript requires the implementation signature to be assignable
// to all overloads. Not visible to callers.
export function defineAsset(asset: any) {
  return { ...ASSET_DEFAULTS, ...asset };
}

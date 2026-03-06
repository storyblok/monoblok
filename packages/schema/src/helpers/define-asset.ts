import type { Asset } from '../types/asset';

/**
 * Defines an asset object with type safety.
 * Returns the input as-is, validated against the Asset type.
 */
export const defineAsset = (asset: Asset): Asset => asset;

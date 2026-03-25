import type { Asset } from './types';

export type UrlToAssetOptions = Partial<Omit<Asset, 'id' | 'filename' | 'space_id' | 'created_at' | 'updated_at' | 'short_filename' | 'content_type' | 'content_length'>>;

export function urlToAsset(
  url: string,
  options?: UrlToAssetOptions,
): Asset {
  // Derive name from last path segment
  const pathSegments = url.split('/');
  const short_filename = pathSegments.at(-1) || url;

  return {
    id: 0,
    filename: url,
    space_id: 0,
    created_at: '',
    updated_at: '',
    short_filename,
    content_type: '',
    content_length: 0,
    is_private: false,
    ...options,
  };
}

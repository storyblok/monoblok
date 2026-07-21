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
    // `id` must be truthy: the CLI's `assets push` pipeline gates the
    // local→remote asset map on `if (localAssetResult.id)` (see
    // packages/cli/src/commands/assets/pipelines.ts), so an `id: 0` entry
    // is skipped and the later `stories push` ref-mapper can't rewrite
    // references to the uploaded asset.
    id: 1,
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

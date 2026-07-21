import type { AssetFieldValue } from './types';

export type UrlToAssetFieldOptions = Partial<Omit<AssetFieldValue, 'fieldtype' | 'filename' | 'id'>>;

export function urlToAssetField(
  url: string,
  options?: UrlToAssetFieldOptions,
): AssetFieldValue {
  // Derive name from last path segment
  const pathSegments = url.split('/');
  const name = pathSegments.at(-1) || url;

  return {
    fieldtype: 'asset',
    // `id` must be truthy: the CLI's `assets push` pipeline gates the
    // local→remote asset map on `if (localAssetResult.id)` (see
    // packages/cli/src/commands/assets/pipelines.ts), so an `id: 0` entry
    // is skipped and the later `stories push` ref-mapper can't rewrite
    // references to the uploaded asset.
    id: 1,
    filename: url,
    name,
    alt: null,
    title: null,
    copyright: null,
    focus: null,
    meta_data: {},
    source: null,
    is_external_url: true,
    ...options,
  };
}

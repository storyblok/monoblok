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

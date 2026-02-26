import type { StoryblokAsset } from './types';

export interface UrlToAssetOptions {
  alt?: string | null;
  title?: string | null;
  copyright?: string | null;
  focus?: string | null;
}

export function urlToAsset(
  url: string,
  options?: UrlToAssetOptions,
): StoryblokAsset {
  // Derive name from last path segment
  const pathSegments = url.split('/');
  const name = pathSegments.at(-1) || url;

  return {
    fieldtype: 'asset',
    id: 0,
    filename: url,
    src: url,
    name,
    alt: null,
    title: null,
    copyright: null,
    focus: null,
    meta_data: {},
    source: null,
    is_external_url: true,
    is_private: false,
    updated_at: '',
    width: null,
    height: null,
    aspect_ratio: null,
    public_id: null,
    content_type: '',
    ...options,
  };
}

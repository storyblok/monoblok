import type { StoryblokMultilink } from './types';

export interface UrlToLinkOptions {
  target?: '_blank' | '_self';
  title?: string;
  rel?: string;
  anchor?: string;
}

export function urlToLink(
  url: string,
  options?: UrlToLinkOptions,
): StoryblokMultilink {
  // Detect mailto: links
  if (url.startsWith('mailto:')) {
    return {
      fieldtype: 'multilink',
      id: '',
      url: '',
      cached_url: '',
      linktype: 'email',
      email: url.slice('mailto:'.length),
      ...options,
    };
  }

  // Extract anchor from fragment
  const hashIndex = url.indexOf('#');
  const anchor = hashIndex === -1 ? undefined : url.slice(hashIndex + 1);
  const cleanUrl = hashIndex === -1 ? url : url.slice(0, hashIndex);

  return {
    fieldtype: 'multilink',
    id: '',
    url: cleanUrl,
    cached_url: cleanUrl,
    linktype: 'url',
    ...(anchor ? { anchor } : {}),
    ...options,
  };
}

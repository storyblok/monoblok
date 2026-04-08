import type { MultilinkFieldValue } from './types';

export type UrlToLinkOptions = Partial<Omit<MultilinkFieldValue, 'fieldtype' | 'id' | 'url' | 'cached_url' | 'linktype'>>;

export function urlToLink(
  url: string,
  options?: UrlToLinkOptions,
): MultilinkFieldValue {
  // Detect mailto: links
  if (url.startsWith('mailto:')) {
    return {
      fieldtype: 'multilink',
      id: '',
      url: url.slice('mailto:'.length),
      cached_url: url.slice('mailto:'.length),
      linktype: 'email',
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

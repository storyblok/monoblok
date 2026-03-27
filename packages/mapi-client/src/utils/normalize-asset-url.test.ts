import { describe, expect, it } from 'vitest';
import { normalizeAssetUrl } from './normalize-asset-url';

describe('normalizeAssetUrl', () => {
  it('strips the S3 origin prefix, returning a CDN URL', () => {
    expect(normalizeAssetUrl('https://s3.amazonaws.com/a.storyblok.com/f/12345/image.png'))
      .toBe('https://a.storyblok.com/f/12345/image.png');
  });

  it('leaves an already-correct CDN URL unchanged', () => {
    const url = 'https://a.storyblok.com/f/12345/image.png';
    expect(normalizeAssetUrl(url)).toBe(url);
  });
});

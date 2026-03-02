import { describe, expect, it } from 'vitest';
import { isInEditor } from './isInEditor';

describe('isInEditor', () => {
  it('returns false when required Storyblok params are missing', () => {
    const url = new URL('https://example.com');

    expect(isInEditor(url)).toBe(false);
  });

  it('returns true when all required Storyblok params are present', () => {
    const url = new URL(
      'https://example.com?'
      + '_storyblok=1&'
      + '_storyblok_c=1&'
      + '_storyblok_tk[space_id]=123',
    );

    expect(isInEditor(url)).toBe(true);
  });

  it('returns false when spaceId option does not match', () => {
    const url = new URL(
      'https://example.com?'
      + '_storyblok=1&'
      + '_storyblok_c=1&'
      + '_storyblok_tk[space_id]=123',
    );

    expect(isInEditor(url, { spaceId: '999' })).toBe(false);
  });

  it('returns true when spaceId option matches', () => {
    const url = new URL(
      'https://example.com?'
      + '_storyblok=1&'
      + '_storyblok_c=1&'
      + '_storyblok_tk[space_id]=123',
    );

    expect(isInEditor(url, { spaceId: '123' })).toBe(true);
  });
});

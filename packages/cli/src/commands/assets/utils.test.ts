import { describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { collectAssetInternalTagNames, ensureAssetInternalTags, extractAssetSizeFromFilename, internalTagNamesFromAssets } from './utils';

describe('extractAssetSizeFromFilename', () => {
  it('extracts the dimensions segment from a CDN URL', () => {
    expect(extractAssetSizeFromFilename('https://a.storyblok.com/f/329189/2048x1820/7fb286a4c5/image.jpg')).toBe('2048x1820');
  });

  it('returns undefined when the URL has no dimensions segment', () => {
    expect(extractAssetSizeFromFilename('https://a.storyblok.com/f/293255674717942/8ae82d3a12/image.jpg')).toBeUndefined();
  });

  it('returns undefined for an empty or invalid filename', () => {
    expect(extractAssetSizeFromFilename(undefined)).toBeUndefined();
    expect(extractAssetSizeFromFilename('not-a-url')).toBeUndefined();
  });
});

describe('internalTagNamesFromAssets', () => {
  it('collects unique tag names in first-seen order, ignoring blanks', () => {
    const names = internalTagNamesFromAssets([
      { internal_tags_list: [{ id: 1, name: 'blue' }, { id: 2, name: 'green' }] },
      { internal_tags_list: [{ id: 3, name: 'blue' }, { id: 4, name: '' }, { id: 5 }] },
      {},
    ]);

    expect(names).toEqual(['blue', 'green']);
  });
});

describe('collectAssetInternalTagNames', () => {
  it('reads sidecars in a directory and returns their unique tag names', async () => {
    vol.fromJSON({
      '/assets/a.png': 'binary',
      '/assets/a.json': JSON.stringify({ internal_tags_list: [{ id: 1, name: 'blue' }] }),
      '/assets/b.png': 'binary',
      '/assets/b.json': JSON.stringify({ internal_tags_list: [{ id: 2, name: 'green' }, { id: 3, name: 'blue' }] }),
      '/assets/notes.txt': 'ignored',
    });

    const names = await collectAssetInternalTagNames('/assets');

    expect([...names].sort()).toEqual(['blue', 'green']);
  });
});

describe('ensureAssetInternalTags', () => {
  it('creates tags missing from the target space and returns them in the map', async () => {
    const createTag = vi.fn(async (name: string) => ({ id: name === 'blue' ? 10 : 11, name }));

    const result = await ensureAssetInternalTags({
      sourceTagNames: ['blue', 'green'],
      targetTagsByName: new Map([['green', 5]]),
      createTag,
    });

    expect(createTag).toHaveBeenCalledTimes(1);
    expect(createTag).toHaveBeenCalledWith('blue');
    expect(result.get('blue')).toBe(10);
    expect(result.get('green')).toBe(5);
  });

  it('reports created tag names via onTagCreated', async () => {
    const onTagCreated = vi.fn();

    await ensureAssetInternalTags({
      sourceTagNames: ['blue', 'red'],
      targetTagsByName: new Map(),
      createTag: async (name: string) => ({ id: 1, name }),
      onTagCreated,
    });

    expect(onTagCreated).toHaveBeenCalledTimes(2);
    expect(onTagCreated).toHaveBeenCalledWith('blue');
    expect(onTagCreated).toHaveBeenCalledWith('red');
  });

  it('deduplicates source names and skips creation when all already exist', async () => {
    const createTag = vi.fn(async (name: string) => ({ id: 1, name }));

    const result = await ensureAssetInternalTags({
      sourceTagNames: ['green', 'green'],
      targetTagsByName: new Map([['green', 5]]),
      createTag,
    });

    expect(createTag).not.toHaveBeenCalled();
    expect(result.get('green')).toBe(5);
  });

  it('degrades gracefully when a tag cannot be created: leaves it unmapped and reports the error', async () => {
    const onTagCreateError = vi.fn();
    const createTag = vi.fn(async (name: string) => {
      if (name === 'blue') {
        throw new Error('boom');
      }
      return { id: 7, name };
    });

    const result = await ensureAssetInternalTags({
      sourceTagNames: ['blue', 'green'],
      targetTagsByName: new Map(),
      createTag,
      onTagCreateError,
    });

    expect(result.has('blue')).toBe(false);
    expect(result.get('green')).toBe(7);
    expect(onTagCreateError).toHaveBeenCalledWith('blue', expect.any(Error));
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { getLocalAssets, updateLocalAsset } from './local-assets';

const FIXTURES_DIR = new URL(
  '__test__/fixtures/.storyblok/assets/12345',
  import.meta.url,
).pathname;

describe('getLocalAssets', () => {
  it('should return all assets from directory', async () => {
    const assets = await getLocalAssets(FIXTURES_DIR);
    expect(assets).toHaveLength(2);
  });

  it('should return asset objects with correct shape', async () => {
    const assets = await getLocalAssets(FIXTURES_DIR);
    const asset = assets.find(a => a.id === 101);
    expect(asset).toBeDefined();
    expect(asset?.short_filename).toBe('hero-image.jpg');
  });

  it('should return empty array for empty directory', async () => {
    const emptyDir = new URL('__test__/fixtures/empty-assets-dir', import.meta.url)
      .pathname;
    await mkdir(emptyDir, { recursive: true });
    const assets = await getLocalAssets(emptyDir);
    expect(assets).toEqual([]);
    await rm(emptyDir, { recursive: true });
  });

  it('should filter to only .json files', async () => {
    const assets = await getLocalAssets(FIXTURES_DIR);
    for (const asset of assets) {
      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('filename');
    }
  });
});

describe('updateLocalAsset', () => {
  const TEST_DIR = new URL('__test__/fixtures/test-write-assets', import.meta.url)
    .pathname;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should write asset as {name}_{id}.json', async () => {
    const asset = {
      id: 999,
      filename: 'https://example.com/test.jpg',
      name: 'test-image.jpg',
      short_filename: 'test-image.jpg',
      alt: 'Test',
      title: undefined,
      copyright: undefined,
      focus: undefined,
    };
    await updateLocalAsset(TEST_DIR, asset as any);
    // The filename should be derived from name without extension + id
    const files = await (await import('node:fs/promises')).readdir(TEST_DIR);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/999\.json$/);
  });

  it('should round-trip: write → read matches', async () => {
    const asset = {
      id: 101,
      filename: 'https://a.storyblok.com/f/12345/1920x1080/hero.jpg',
      name: 'hero-image.jpg',
      short_filename: 'hero-image.jpg',
      alt: 'Hero image',
      title: 'Hero',
      copyright: undefined,
      focus: undefined,
    };
    await updateLocalAsset(TEST_DIR, asset as any);
    const assets = await getLocalAssets(TEST_DIR);
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe(101);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getLocalDatasources,
  updateLocalDatasource,
} from './local-datasources';

const FIXTURES_DIR = new URL(
  '__test__/fixtures/.storyblok/datasources/12345',
  import.meta.url,
).pathname;

describe('getLocalDatasources', () => {
  it('should return all datasources from directory', async () => {
    const datasources = await getLocalDatasources(FIXTURES_DIR);
    expect(datasources).toHaveLength(2);
  });

  it('should return datasource objects with correct shape', async () => {
    const datasources = await getLocalDatasources(FIXTURES_DIR);
    const colors = datasources.find(d => d.slug === 'colors');
    expect(colors).toBeDefined();
    expect(colors?.name).toBe('Colors');
  });

  it('should return empty array for empty directory', async () => {
    const emptyDir = new URL('__test__/fixtures/empty-datasources-dir', import.meta.url)
      .pathname;
    await mkdir(emptyDir, { recursive: true });
    const datasources = await getLocalDatasources(emptyDir);
    expect(datasources).toEqual([]);
    await rm(emptyDir, { recursive: true });
  });

  it('should filter to only .json files', async () => {
    const datasources = await getLocalDatasources(FIXTURES_DIR);
    for (const ds of datasources) {
      expect(ds).toHaveProperty('id');
      expect(ds).toHaveProperty('slug');
    }
  });
});

describe('updateLocalDatasource', () => {
  const TEST_DIR = new URL('__test__/fixtures/test-write-datasources', import.meta.url)
    .pathname;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should write datasource as {slug}_{id}.json', async () => {
    const datasource = {
      id: 99,
      name: 'Test DS',
      slug: 'test-ds',
      dimensions: [],
    };
    await updateLocalDatasource(TEST_DIR, datasource as any);
    const filePath = join(TEST_DIR, 'test-ds_99.json');
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.slug).toBe('test-ds');
    expect(parsed.id).toBe(99);
  });

  it('should round-trip: write → read matches', async () => {
    const datasource = {
      id: 1,
      name: 'Colors',
      slug: 'colors',
      dimensions: [],
    };
    await updateLocalDatasource(TEST_DIR, datasource as any);
    const datasources = await getLocalDatasources(TEST_DIR);
    expect(datasources).toHaveLength(1);
    expect(datasources[0].slug).toBe('colors');
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getLocalComponents,
  updateLocalComponent,
} from './local-components';

const FIXTURES_DIR = new URL(
  '__test__/fixtures/.storyblok/components/12345',
  import.meta.url,
).pathname;

describe('getLocalComponents', () => {
  it('should return all components from directory', async () => {
    const components = await getLocalComponents(FIXTURES_DIR);
    expect(components).toHaveLength(2);
  });

  it('should return component objects with correct shape', async () => {
    const components = await getLocalComponents(FIXTURES_DIR);
    const hero = components.find(c => c.name === 'hero');
    expect(hero).toBeDefined();
    expect(hero?.schema).toHaveProperty('headline');
  });

  it('should return empty array for empty directory', async () => {
    const emptyDir = new URL('__test__/fixtures/empty-components-dir', import.meta.url)
      .pathname;
    await mkdir(emptyDir, { recursive: true });
    const components = await getLocalComponents(emptyDir);
    expect(components).toEqual([]);
    await rm(emptyDir, { recursive: true });
  });

  it('should filter to only .json files', async () => {
    const components = await getLocalComponents(FIXTURES_DIR);
    for (const component of components) {
      expect(component).toHaveProperty('name');
      expect(component).toHaveProperty('schema');
    }
  });
});

describe('updateLocalComponent', () => {
  const TEST_DIR = new URL('__test__/fixtures/test-write-components', import.meta.url)
    .pathname;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should write component as {name}.json', async () => {
    const component = {
      id: 99,
      name: 'test-component',
      display_name: 'Test Component',
      schema: { title: { type: 'text' } },
      component_group_uuid: undefined,
    };
    await updateLocalComponent(TEST_DIR, component as any);
    const filePath = join(TEST_DIR, 'test-component.json');
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.name).toBe('test-component');
  });

  it('should round-trip: write → read matches', async () => {
    const component = {
      id: 1,
      name: 'hero',
      display_name: 'Hero',
      schema: { headline: { type: 'text' } },
      component_group_uuid: undefined,
    };
    await updateLocalComponent(TEST_DIR, component as any);
    const components = await getLocalComponents(TEST_DIR);
    expect(components).toHaveLength(1);
    expect(components[0].name).toBe('hero');
  });
});

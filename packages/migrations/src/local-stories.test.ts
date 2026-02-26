import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { getLocalStories, updateLocalStory } from './local-stories';

const FIXTURES_DIR = new URL(
  '__test__/fixtures/.storyblok/stories/12345',
  import.meta.url,
).pathname;

describe('getLocalStories', () => {
  it('should return all stories from directory', async () => {
    const stories = await getLocalStories(FIXTURES_DIR);
    expect(stories).toHaveLength(2);
  });

  it('should return story objects with correct shape', async () => {
    const stories = await getLocalStories(FIXTURES_DIR);
    const story = stories.find(s => s.slug === 'hello-world');
    expect(story).toBeDefined();
    expect(story?.uuid).toBe('abc123');
    expect(story?.content?.component).toBe('page');
  });

  it('should return empty array for empty directory', async () => {
    const emptyDir = new URL('__test__/fixtures/empty-dir', import.meta.url).pathname;
    await mkdir(emptyDir, { recursive: true });
    const stories = await getLocalStories(emptyDir);
    expect(stories).toEqual([]);
    await rm(emptyDir, { recursive: true });
  });

  it('should filter to only .json files', async () => {
    const stories = await getLocalStories(FIXTURES_DIR);
    // All returned items should be valid story objects (not .gitkeep etc)
    for (const story of stories) {
      expect(story).toHaveProperty('slug');
      expect(story).toHaveProperty('uuid');
    }
  });
});

describe('updateLocalStory', () => {
  const TEST_DIR = new URL('__test__/fixtures/test-write', import.meta.url).pathname;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should write story as {slug}_{uuid}.json', async () => {
    const story = {
      id: 99,
      uuid: 'test-uuid',
      slug: 'test-story',
      full_slug: 'test-story',
      name: 'Test Story',
      content: { component: 'page' },
      created_at: '2024-01-01T00:00:00.000Z',
      published_at: undefined,
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    await updateLocalStory(TEST_DIR, story as any);
    const filePath = join(TEST_DIR, 'test-story_test-uuid.json');
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.slug).toBe('test-story');
    expect(parsed.uuid).toBe('test-uuid');
  });

  it('should round-trip: read → modify → write → read matches', async () => {
    const story = {
      id: 1,
      uuid: 'abc123',
      slug: 'hello-world',
      full_slug: 'hello-world',
      name: 'Hello World',
      content: { component: 'page', headline: 'Hello World' },
      created_at: '2024-01-01T00:00:00.000Z',
      published_at: undefined,
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    await updateLocalStory(TEST_DIR, story as any);
    const stories = await getLocalStories(TEST_DIR);
    expect(stories).toHaveLength(1);
    expect(stories[0].slug).toBe('hello-world');
  });
});

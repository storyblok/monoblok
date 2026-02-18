import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { vol } from 'memfs';
import { readLocalStoriesStream } from './streams';

const STORIES_DIR = '/tmp/stories';

const writeStory = (story: Record<string, unknown>) => {
  const filePath = path.join(STORIES_DIR, `${story.slug}_${story.uuid}.json`);
  vol.fromJSON({ [filePath]: JSON.stringify(story) });
};

const collectStream = async (stream: ReturnType<typeof readLocalStoriesStream>): Promise<any[]> => {
  const results: any[] = [];
  for await (const story of stream) {
    results.push(story);
  }
  return results;
};

describe('readLocalStoriesStream', () => {
  it('should yield parent folders before their children', async () => {
    const folder = {
      name: 'Folder',
      id: 100,
      uuid: randomUUID(),
      parent_id: null,
      is_folder: true,
      slug: 'folder',
    };
    const child = {
      name: 'Child',
      id: 200,
      uuid: randomUUID(),
      parent_id: 100,
      is_folder: false,
      slug: 'child',
    };
    // Write child first to ensure filesystem order doesn't dictate output
    writeStory(child);
    writeStory(folder);

    const stream = readLocalStoriesStream({ directoryPath: STORIES_DIR });
    const results = await collectStream(stream);

    expect(results).toHaveLength(2);
    const folderIndex = results.findIndex(s => s.id === 100);
    const childIndex = results.findIndex(s => s.id === 200);
    expect(folderIndex).toBeLessThan(childIndex);
  });

  it('should yield deeply nested stories in correct order', async () => {
    const root = {
      name: 'Root',
      id: 1,
      uuid: randomUUID(),
      parent_id: null,
      is_folder: true,
      slug: 'root',
    };
    const mid = {
      name: 'Mid',
      id: 2,
      uuid: randomUUID(),
      parent_id: 1,
      is_folder: true,
      slug: 'mid',
    };
    const leaf = {
      name: 'Leaf',
      id: 3,
      uuid: randomUUID(),
      parent_id: 2,
      is_folder: false,
      slug: 'leaf',
    };
    // Write in reverse order
    writeStory(leaf);
    writeStory(mid);
    writeStory(root);

    const stream = readLocalStoriesStream({ directoryPath: STORIES_DIR });
    const results = await collectStream(stream);

    expect(results).toHaveLength(3);
    const rootIdx = results.findIndex(s => s.id === 1);
    const midIdx = results.findIndex(s => s.id === 2);
    const leafIdx = results.findIndex(s => s.id === 3);
    expect(rootIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(leafIdx);
  });

  it('should yield orphan stories without hanging', async () => {
    const orphan = {
      name: 'Orphan',
      id: 10,
      uuid: randomUUID(),
      parent_id: 999,
      is_folder: false,
      slug: 'orphan',
    };
    writeStory(orphan);

    const stream = readLocalStoriesStream({ directoryPath: STORIES_DIR });
    const results = await collectStream(stream);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(10);
  });

  it('should yield root stories with parent_id 0', async () => {
    const story = {
      name: 'Root Story',
      id: 5,
      uuid: randomUUID(),
      parent_id: 0,
      is_folder: false,
      slug: 'root-story',
    };
    writeStory(story);

    const stream = readLocalStoriesStream({ directoryPath: STORIES_DIR });
    const results = await collectStream(stream);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(5);
  });
});

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
  it('should yield all stories from the directory', async () => {
    const storyA = {
      name: 'Story A',
      id: 100,
      uuid: randomUUID(),
      parent_id: null,
      is_folder: false,
      slug: 'story-a',
    };
    const storyB = {
      name: 'Story B',
      id: 200,
      uuid: randomUUID(),
      parent_id: 100,
      is_folder: false,
      slug: 'story-b',
    };
    writeStory(storyA);
    writeStory(storyB);

    const stream = readLocalStoriesStream({ directoryPath: STORIES_DIR });
    const results = await collectStream(stream);

    expect(results).toHaveLength(2);
    expect(results.map(s => s.id)).toEqual(expect.arrayContaining([100, 200]));
  });

  it('should yield stories with parent_id 0', async () => {
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

  it('should report errors for invalid JSON files without stopping', async () => {
    const validStory = {
      name: 'Valid',
      id: 1,
      uuid: randomUUID(),
      parent_id: null,
      is_folder: false,
      slug: 'valid',
    };
    writeStory(validStory);
    vol.fromJSON({ [path.join(STORIES_DIR, 'bad_file.json')]: '{invalid json' });

    const errors: string[] = [];
    const stream = readLocalStoriesStream({
      directoryPath: STORIES_DIR,
      onStoryError(_error, filename) {
        errors.push(filename);
      },
    });
    const results = await collectStream(stream);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
    expect(errors).toHaveLength(1);
  });
});

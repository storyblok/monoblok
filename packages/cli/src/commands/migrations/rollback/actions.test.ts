import { vol } from 'memfs';
import { readRollbackFile, saveRollbackData } from './actions';
import { CommandError } from '../../../utils';
import type { StoryContent } from '../../stories/constants';

// Mock dependencies
vi.mock('node:fs');
vi.mock('node:fs/promises');

const mockStoryContent: StoryContent = {
  _uid: 'test-uid',
  component: 'test',
  body: [],
};

describe('saveRollbackData', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should save rollback data successfully', async () => {
    const mockStory1 = {
      id: 1,
      name: 'Test Story 1',
      content: mockStoryContent,
    };
    await saveRollbackData({
      space: '12345',
      path: '/test/path',
      story: mockStory1,
      migrationTimestamp: 123,
      migrationNames: ['test-migration.js'],
    });
    const mockStory2 = {
      id: 2,
      name: 'Test Story 2',
      content: mockStoryContent,
    };
    await saveRollbackData({
      space: '12345',
      path: '/test/path',
      story: mockStory2,
      migrationTimestamp: 123,
      migrationNames: ['test-migration.js'],
    });

    // Check if file was created with correct content
    const rollbackFiles = vol.readdirSync('/test/path/migrations/12345/rollbacks');
    expect(rollbackFiles.length).toBe(1);
    expect(rollbackFiles[0]).toBe('test-migration.123.jsonl');

    const fileContent = vol.readFileSync(`/test/path/migrations/12345/rollbacks/${rollbackFiles[0]}`);
    const savedContent = fileContent.toString('utf8').trim().split('\n').map(x => JSON.parse(x));
    expect(savedContent).toEqual([
      {
        storyId: 1,
        name: 'Test Story 1',
        content: mockStoryContent,
      },
      {
        storyId: 2,
        name: 'Test Story 2',
        content: mockStoryContent,
      },
    ]);
  });

  it('should create directory if it does not exist', async () => {
    const mockStory = {
      id: 1,
      name: 'Test Story',
      content: mockStoryContent,
    };

    await saveRollbackData({
      space: '12345',
      path: '/nonexistent/path',
      story: mockStory,
      migrationTimestamp: 123,
      migrationNames: ['test-migration.js'],
    });

    // Verify directory was created
    expect(vol.existsSync('/nonexistent/path/migrations/12345/rollbacks')).toBe(true);
  });
});

describe('readRollbackFile', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should read rollback file successfully', async () => {
    const mockRollbackData = [
      {
        storyId: 1,
        name: 'Test Story',
        content: mockStoryContent,
      },
    ];

    // Create mock rollback file
    vol.fromJSON({
      '.storyblok/migrations/12345/rollbacks/test-migration.jsonl': mockRollbackData.map(x => JSON.stringify(x)).join('\n'),
    });

    const result = await readRollbackFile({
      space: '12345',
      path: '.storyblok',
      migrationFile: 'test-migration',
    });

    expect(result).toEqual({ stories: mockRollbackData });
  });

  it('should throw error when file does not exist', async () => {
    await expect(
      readRollbackFile({
        space: '12345',
        path: '.storyblok',
        migrationFile: 'nonexistent',
      }),
    ).rejects.toThrow(CommandError);
  });

  it('should throw error when file is invalid JSON', async () => {
    // Create invalid JSON file
    vol.fromJSON({
      '.storyblok/migrations/12345/rollbacks/test-migration.jsonl': 'invalid json',
    });

    await expect(
      readRollbackFile({
        space: '12345',
        path: '.storyblok',
        migrationFile: 'test-migration',
      }),
    ).rejects.toThrow(CommandError);
  });
});

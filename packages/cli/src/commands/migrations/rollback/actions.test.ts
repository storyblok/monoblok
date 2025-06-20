import { vol } from 'memfs';
import { readRollbackFile, type RollbackData, saveRollbackData } from './actions';
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
    const mockStories = [
      {
        id: 1,
        name: 'Test Story',
        content: mockStoryContent,
      },
    ];

    await saveRollbackData({
      space: '12345',
      path: '/test/path',
      stories: mockStories,
      migrationFile: 'test-migration.js',
    });

    // Check if file was created with correct content
    const rollbackFiles = vol.readdirSync('/test/path/migrations/12345/rollbacks');
    expect(rollbackFiles.length).toBe(1);
    expect(rollbackFiles[0]).toMatch(/test-migration\.\d+\.json/);

    const fileContent = vol.readFileSync(`/test/path/migrations/12345/rollbacks/${rollbackFiles[0]}`);
    const savedContent = JSON.parse(fileContent.toString('utf8'));
    expect(savedContent).toEqual({
      stories: [{
        storyId: 1,
        name: 'Test Story',
        content: mockStoryContent,
      }],
    });
  });

  it('should create directory if it does not exist', async () => {
    const mockStories = [
      {
        id: 1,
        name: 'Test Story',
        content: mockStoryContent,
      },
    ];

    await saveRollbackData({
      space: '12345',
      path: '/nonexistent/path',
      stories: mockStories,
      migrationFile: 'test-migration.js',
    });

    // Verify directory was created
    expect(vol.existsSync('/nonexistent/path/migrations/12345/rollbacks')).toBe(true);
  });

  it('should handle empty stories array', async () => {
    await saveRollbackData({
      space: '12345',
      path: '/test/path',
      stories: [],
      migrationFile: 'test-migration.js',
    });

    const rollbackFiles = vol.readdirSync('/test/path/migrations/12345/rollbacks');
    expect(rollbackFiles.length).toBe(1);

    const fileContent = vol.readFileSync(`/test/path/migrations/12345/rollbacks/${rollbackFiles[0]}`);
    const savedContent = JSON.parse(fileContent.toString('utf8'));
    expect(savedContent.stories).toEqual([]);
  });
});

describe('readRollbackFile', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should read rollback file successfully', async () => {
    const mockRollbackData: RollbackData = {
      stories: [
        {
          storyId: 1,
          name: 'Test Story',
          content: mockStoryContent,
        },
      ],
    };

    // Create mock rollback file
    vol.fromJSON({
      '.storyblok/migrations/12345/rollbacks/test-migration.json': JSON.stringify(mockRollbackData),
    });

    const result = await readRollbackFile({
      space: '12345',
      path: '.storyblok',
      migrationFile: 'test-migration',
    });

    expect(result).toEqual(mockRollbackData);
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
      '.storyblok/migrations/12345/rollbacks/test-migration.json': 'invalid json',
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

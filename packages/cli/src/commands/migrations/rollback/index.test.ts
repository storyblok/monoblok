import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
// Import the main module first to ensure proper initialization
import '../index';
import { migrationsCommand } from '../command';
import { readRollbackFile } from './actions';
import { updateStory } from '../../stories/actions';
import type { RollbackData } from './actions';
import type { StoryContent } from '../../stories/constants';
import { getLogFileContents } from '../../__tests__/helpers';
import { session } from '../../../session';
import { loggedOutSessionState } from '../../../../test/setup';

vi.mock('./actions', () => ({
  readRollbackFile: vi.fn(),
}));

vi.mock('../../stories/actions', () => ({
  updateStory: vi.fn(),
}));

vi.spyOn(console, 'error');
vi.spyOn(console, 'log');

const LOG_PREFIX = 'storyblok-migrations-rollback-';

const mockStoryContent: StoryContent = {
  _uid: 'test-uid',
  component: 'test',
  body: [],
};
const mockRollbackData: RollbackData = {
  stories: [
    {
      storyId: 1,
      name: 'Test Story',
      content: mockStoryContent,
    },
    {
      storyId: 2,
      name: 'Another Story',
      content: mockStoryContent,
    },
  ],
};

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
  canLoadRollbackFile() {
    vi.mocked(readRollbackFile).mockResolvedValue(mockRollbackData);
  },
  canNotLoadRollbackFile() {
    vi.mocked(readRollbackFile).mockRejectedValue(new Error('File not found'));
  },
  canUpdateStory() {
    vi.mocked(updateStory).mockResolvedValue({ id: 1 });
  },
  canNotUpdateStory() {
    vi.mocked(updateStory).mockRejectedValue(new Error('Update failed'));
  },
  canRollback() {
    this.canLoadRollbackFile();
    this.canUpdateStory();
  },
};

describe('migrations rollback command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
  });

  it('should rollback a migration successfully', async () => {
    preconditions.canRollback();

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
    ]);

    expect(readRollbackFile).toHaveBeenCalledWith({
      space: '12345',
      path: undefined,
      migrationFile: 'test-migration',
    });
    expect(updateStory).toHaveBeenCalledTimes(2);
    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      1,
      {
        story: {
          content: mockStoryContent,
          id: 1,
          name: 'Test Story',
        },
        force_update: '1',
      },
    );
    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      2,
      {
        story: {
          content: mockStoryContent,
          id: 2,
          name: 'Another Story',
        },
        force_update: '1',
      },
    );
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Migration rollback finished');
    expect(logFile).toContain('"succeeded":2');
  });

  it('should handle not logged in error', async () => {
    await preconditions.loggedOut();

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
    ]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('You are currently not logged in'),
      '',
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('For more information about the error'),
    );
    expect(readRollbackFile).not.toHaveBeenCalled();
    expect(updateStory).not.toHaveBeenCalled();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('You are currently not logged in');
  });

  it('should handle missing space error', async () => {
    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
    ]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Please provide the space as argument --space YOUR_SPACE_ID.'),
      '',
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('For more information about the error'),
    );
    expect(readRollbackFile).not.toHaveBeenCalled();
    expect(updateStory).not.toHaveBeenCalled();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Please provide the space as argument');
  });

  it('should handle rollback file read error', async () => {
    preconditions.canNotLoadRollbackFile();

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
    ]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to rollback migration: File not found'),
      '',
    );
    expect(updateStory).not.toHaveBeenCalled();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Failed to rollback migration');
  });

  it('should handle story update error', async () => {
    preconditions.canLoadRollbackFile();
    preconditions.canNotUpdateStory();

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
    ]);

    expect(updateStory).toHaveBeenCalledTimes(2);
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Failed to restore story');
  });

  it('should handle custom path option', async () => {
    preconditions.canRollback();

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
      '--path',
      '/custom/path',
    ]);

    expect(readRollbackFile).toHaveBeenCalledWith({
      space: '12345',
      path: '/custom/path',
      migrationFile: 'test-migration',
    });
  });
});

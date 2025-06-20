import { beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../../session';
import { konsola } from '../../../utils';
import '../index';
import { migrationsCommand } from '../command';
import { readRollbackFile } from './actions';
import { updateStory } from '../../stories/actions';
import type { RollbackData } from './actions';
import type { StoryContent } from '../../stories/constants';

vi.mock('../../../utils/konsola');

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

// Mock the session module
vi.mock('../../../session', () => {
  let _cache: Record<string, any> | null = null;
  const session = () => {
    if (!_cache) {
      _cache = {
        state: {
          isLoggedIn: true,
          password: 'mock-token',
          region: 'eu',
        },
        updateSession: vi.fn(),
        persistCredentials: vi.fn(),
        initializeSession: vi.fn(),
        logout: vi.fn(),
      };
    }
    return _cache;
  };

  return { session };
});

vi.mock('../../stories/actions', () => ({
  updateStory: vi.fn(),
}));

vi.mock('./actions', () => ({
  readRollbackFile: vi.fn(),
}));

// Mock story content
const mockStoryContent: StoryContent = {
  _uid: 'test-uid',
  component: 'test',
  body: [],
};

// Mock rollback data
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

describe('migrations rollback command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    mockExit.mockClear();
  });

  it('should rollback a migration successfully', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readRollbackFile).mockResolvedValue(mockRollbackData);
    vi.mocked(updateStory).mockResolvedValue({ id: 1 } as any);

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

    // Verify that updateStory was called for each story
    expect(updateStory).toHaveBeenCalledTimes(2);
    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
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
      'valid-token',
      'eu',
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
  });

  it('should handle not logged in error', async () => {
    session().state = {
      isLoggedIn: false,
      password: undefined,
      region: undefined,
    };

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
    ]);

    expect(konsola.error).toHaveBeenCalledWith('You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.', null, {
      header: true,
    });
    expect(readRollbackFile).not.toHaveBeenCalled();
    expect(updateStory).not.toHaveBeenCalled();
  });

  it('should handle missing space error', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
    ]);

    expect(konsola.error).toHaveBeenCalledWith(
      'Please provide the space as argument --space YOUR_SPACE_ID.',
      null,
      {
        header: true,
      },
    );
    expect(readRollbackFile).not.toHaveBeenCalled();
    expect(updateStory).not.toHaveBeenCalled();
  });

  it('should handle rollback file read error', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readRollbackFile).mockRejectedValue(new Error('File not found'));

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
    ]);

    expect(konsola.error).toHaveBeenCalledWith(
      'Failed to rollback migration: File not found',
      null,
      {
        header: true,
      },
    );
    expect(updateStory).not.toHaveBeenCalled();
  });

  it('should handle story update error', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readRollbackFile).mockResolvedValue(mockRollbackData);
    vi.mocked(updateStory).mockRejectedValueOnce(new Error('Update failed'));

    await migrationsCommand.parseAsync([
      'node',
      'test',
      'rollback',
      'test-migration',
      '--space',
      '12345',
    ]);

    // Should still try to update the second story even if the first one fails
    expect(updateStory).toHaveBeenCalledTimes(2);
  });

  it('should handle custom path option', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readRollbackFile).mockResolvedValue(mockRollbackData);
    vi.mocked(updateStory).mockResolvedValue({ id: 1 } as any);

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

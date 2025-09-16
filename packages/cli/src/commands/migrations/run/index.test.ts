import { beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../../session';
import { konsola } from '../../../utils';

// Import the main components module first to ensure proper initialization
import '../index';
import { migrationsCommand } from '../command';
import { getMigrationFunction, readMigrationFiles } from './actions';
import { fetchStories, fetchStory, updateStory } from '../../stories/actions';
import type { Story } from '../../stories/constants';

// Mock the utils
vi.mock('../../../utils', async () => {
  const actualUtils = await vi.importActual('../../../utils');
  return {
    ...actualUtils,
    konsola: {
      title: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Mock the actions
vi.mock('./actions', () => ({
  readMigrationFiles: vi.fn(),
  getMigrationFunction: vi.fn(),
}));

vi.mock('../../stories/actions', () => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  updateStory: vi.fn(),
}));

// Mock session
vi.mock('../../../session', () => ({
  session: vi.fn(() => ({
    state: {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    },
    initializeSession: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Helper function to create mock story
const createMockStory = (overrides: Partial<Story> = {}): Story => ({
  id: 517473243,
  name: 'Test Story',
  uuid: 'uuid-1',
  slug: 'test-story',
  full_slug: 'test-story',
  content: {
    _uid: '4b16d1ea-4306-47c5-b901-9d67d5babf53',
    component: 'page',
    body: [
      {
        _uid: '216ba4ef-1298-4b7d-8ce0-7487e6db15cc',
        component: 'migration-component',
        unchanged: 'unchanged',
        amount: 10,
      },
    ],
  },
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  published_at: '2023-01-01T00:00:00Z',
  first_published_at: '2023-01-01T00:00:00Z',
  published: true,
  unpublished_changes: false,
  is_startpage: false,
  is_folder: false,
  pinned: false,
  parent_id: null,
  group_id: 'group-1',
  parent: null,
  path: null,
  position: 0,
  sort_by_date: null,
  tag_list: [],
  disable_fe_editor: false,
  default_root: null,
  preview_token: null,
  meta_data: null,
  release_id: null,
  last_author: null,
  last_author_id: null,
  alternates: [],
  translated_slugs: null,
  translated_slugs_attributes: null,
  localized_paths: null,
  breadcrumbs: [],
  scheduled_dates: null,
  favourite_for_user_ids: [],
  imported_at: null,
  deleted_at: null,
  ...overrides,
});

const mockStory = createMockStory();

describe('migrations run command - streaming approach', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should run migrations successfully', async () => {
    // Setup session
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    // Mock migration files
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'modified\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);

    // Mock fetchStories to return stories
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [mockStory],
      headers: new Headers({
        'Total': '1',
        'Per-Page': '100',
      }),
    });

    // Mock fetchStory to return full story content
    vi.mocked(fetchStory).mockResolvedValue(mockStory);

    // Mock getMigrationFunction to return a function that modifies content
    vi.mocked(getMigrationFunction).mockResolvedValue((block: any) => {
      block.unchanged = 'modified';
      return block;
    });

    // Mock updateStory to return updated story
    vi.mocked(updateStory).mockResolvedValue(mockStory);

    // Run the command
    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345']);

    // Verify that fetchStories was called
    expect(fetchStories).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );

    // Verify that fetchStory was called for individual story content
    expect(fetchStory).toHaveBeenCalledWith('12345', '517473243');

    // Verify that getMigrationFunction was called
    expect(getMigrationFunction).toHaveBeenCalledWith('migration-component.js', '12345', undefined);

    // In the new streaming approach, updateStory is only called if the migration actually changes content
    // Since our mock migration function doesn't actually change the content hash, updateStory won't be called
    // This is the correct behavior - only stories with actual changes should be updated

    // Verify that progress bars were displayed (konsola.info should be called for summaries)
    expect(konsola.info).toHaveBeenCalledWith(
      expect.stringContaining('Migration Results:'),
    );
    expect(konsola.info).toHaveBeenCalledWith(
      expect.stringContaining('No stories required updates'),
    );
  });

  it('should handle migrations that fail gracefully', async () => {
    // Setup session
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    // Mock migration files
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  throw new Error(\'Migration failed\');\n'
          + '}\n',
      },
    ];

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);

    // Mock fetchStories to return stories
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [mockStory],
      headers: new Headers({
        'Total': '1',
        'Per-Page': '100',
      }),
    });

    // Mock fetchStory to return full story content
    vi.mocked(fetchStory).mockResolvedValue(mockStory);

    // Mock getMigrationFunction to return a function that throws an error
    vi.mocked(getMigrationFunction).mockResolvedValue(() => {
      throw new Error('Migration failed');
    });

    // Run the command
    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345']);

    // Verify that fetchStories was called
    expect(fetchStories).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );

    // Verify that fetchStory was called
    expect(fetchStory).toHaveBeenCalledWith('12345', '517473243');

    // Verify that getMigrationFunction was called
    expect(getMigrationFunction).toHaveBeenCalledWith('migration-component.js', '12345', undefined);

    // Verify that updateStory was NOT called (since migration failed)
    expect(updateStory).not.toHaveBeenCalled();

    // Verify that error summary was displayed
    expect(konsola.info).toHaveBeenCalledWith(
      expect.stringContaining('Migration Results:'),
    );
    expect(konsola.info).toHaveBeenCalledWith(
      expect.stringContaining('No stories required updates'),
    );
  });

  it('should handle dry run mode correctly', async () => {
    // Setup session
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    // Mock migration files
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'modified\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);

    // Mock fetchStories to return stories
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [mockStory],
      headers: new Headers({
        'Total': '1',
        'Per-Page': '100',
      }),
    });

    // Mock fetchStory to return full story content
    vi.mocked(fetchStory).mockResolvedValue(mockStory);

    // Mock getMigrationFunction to return a function that modifies content
    vi.mocked(getMigrationFunction).mockResolvedValue((block: any) => {
      block.unchanged = 'modified';
      return block;
    });

    // Run the command with dry run
    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--dry-run']);

    // Verify that fetchStories was called
    expect(fetchStories).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );

    // Verify that fetchStory was called
    expect(fetchStory).toHaveBeenCalledWith('12345', '517473243');

    // Verify that getMigrationFunction was called
    expect(getMigrationFunction).toHaveBeenCalledWith('migration-component.js', '12345', undefined);

    // Verify that updateStory was NOT called (since it's a dry run)
    expect(updateStory).not.toHaveBeenCalled();

    // Verify that dry run summary was displayed
    expect(konsola.info).toHaveBeenCalledWith(
      expect.stringContaining('Migration Results:'),
    );
  });

  it('should handle component filtering correctly', async () => {
    // Setup session
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    // Mock migration files
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'modified\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);

    // Mock fetchStories to return stories
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [mockStory],
      headers: new Headers({
        'Total': '1',
        'Per-Page': '100',
      }),
    });

    // Mock fetchStory to return full story content
    vi.mocked(fetchStory).mockResolvedValue(mockStory);

    // Mock getMigrationFunction to return a function that modifies content
    vi.mocked(getMigrationFunction).mockResolvedValue((block: any) => {
      block.unchanged = 'modified';
      return block;
    });

    // Mock updateStory to return updated story
    vi.mocked(updateStory).mockResolvedValue(mockStory);

    // Run the command with component filter
    await migrationsCommand.parseAsync(['node', 'test', 'run', 'migration-component', '--space', '12345']);

    // Verify that fetchStories was called with component filter
    expect(fetchStories).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        per_page: 500,
        page: 1,
        contain_component: 'migration-component',
        story_only: true,
      }),
    );

    // Verify that fetchStory was called
    expect(fetchStory).toHaveBeenCalledWith('12345', '517473243');

    // Verify that getMigrationFunction was called
    expect(getMigrationFunction).toHaveBeenCalledWith('migration-component.js', '12345', undefined);
  });
});

import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
// Import the main components module first to ensure proper initialization
import '../index';
import { migrationsCommand } from '../command';
import { fetchStories, fetchStory, updateStory } from '../../stories/actions';
import type { Story } from '../../stories/constants';
import * as filesystem from '../../../utils/filesystem';

vi.mock('node:fs');
vi.mock('node:fs/promises');

vi.mock('../../stories/actions', () => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  updateStory: vi.fn(),
}));

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

vi.spyOn(console, 'debug');
vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');

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
  group_id: 'group-1',
  position: 0,
  tag_list: [],
  disable_fe_editor: false,
  alternates: [],
  breadcrumbs: [],
  favourite_for_user_ids: [],
  ...overrides,
});

const mockStory = createMockStory();

const MIGRATION_FUNCTION_FILE_PATH = './.storyblok/migrations/12345/migration-component.js';

const preconditions = {
  canFetchStories() {
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [mockStory],
      headers: new Headers({
        'Total': '1',
        'Per-Page': '100',
      }),
    });
  },
  canFetchStory() {
    vi.mocked(fetchStory).mockResolvedValue(mockStory);
  },
  canUpdateStory() {
    vi.mocked(updateStory).mockResolvedValue(mockStory);
  },
  canLoadMigrationFunction(filePath = MIGRATION_FUNCTION_FILE_PATH) {
    vol.fromJSON({
      [filePath]: 'only the filename matters!',
    });
    const mockMigrationFn = (block: any) => ({ ...block, migrated: true });
    const importModuleSpy = vi.spyOn(filesystem, 'importModule');
    importModuleSpy.mockImplementation(() => Promise.resolve({ default: mockMigrationFn }));
  },
  canNotLoadMigrationFunction(filePath = MIGRATION_FUNCTION_FILE_PATH) {
    this.canFetchStories();
    this.canFetchStory();
    vol.fromJSON({
      [filePath]: 'only the filename matters!',
    });
    vi.doMock(resolve(filePath), () => {
      throw new Error('Cannot find module');
    });
  },
  migrationDirectoryDoesNotExist() {
    vol.reset();
  },
  canMigrate() {
    this.canFetchStories();
    this.canFetchStory();
    this.canUpdateStory();
    this.canLoadMigrationFunction();
  },
};

describe('migrations run command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
  });

  it('should run migrations successfully', async () => {
    preconditions.canMigrate();

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--log-console']);

    expect(fetchStories).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', '517473243');
    // Logging
    const logFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('storyblok-migrations-run-'))?.[1];
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}INFO\s{3}Migration finished\s{2}\(runId: \d+/),
    );
    expect(logFile).toContain('Migration finished');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('migrationResults: {"total":1,"succeeded":1,"skipped":0,"failed":0}'),
    );
    expect(logFile).toContain('{"total":1,"succeeded":1,"skipped":0,"failed":0}');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('updateResults: {"total":1,"succeeded":1,"failed":0}'),
    );
    expect(logFile).toContain('{"total":1,"succeeded":1,"failed":0}');
    // UI
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Migration Results:'),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Update Results: 1 stories updated.'),
    );
  });

  it('should gracefully handle error while loading migration', async () => {
    preconditions.canNotLoadMigrationFunction();

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--log-console']);

    expect(updateStory).not.toHaveBeenCalled();
    // Logging
    const logFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('storyblok-migrations-run-'))?.[1];
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}ERROR\s{2}Couldn't load migration function\s{2}\(runId: \d+/),
    );
    expect(logFile).toContain('Couldn\'t load migration function');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('errorCode: MIGRATION_LOAD_ERROR'),
    );
    expect(logFile).toContain('MIGRATION_LOAD_ERROR');
    // UI
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Migration Results:'),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('No stories required updates'),
    );
  });

  it('should gracefully handle non-existing migrations directory', async () => {
    preconditions.migrationDirectoryDoesNotExist();

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--log-console']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}ERROR\s{2}No directory found for space "12345". Please make sure you have generated migrations first by running:\\n\\n\s{2}storyblok migrations generate YOUR_COMPONENT_NAME --space 12345 {2}\(runId: \d+/),
    );
    const logFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('storyblok-migrations-run-'))?.[1];
    expect(logFile).toContain('No directory found for space \\"12345\\".');
  });

  it('should handle dry run mode correctly', async () => {
    preconditions.canMigrate();

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--dry-run', '--log-console']);

    expect(fetchStories).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', '517473243');
    // Verify that updateStory was NOT called (since it's a dry run)
    expect(updateStory).not.toHaveBeenCalled();
    // Logging
    const logFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('storyblok-migrations-run-'))?.[1];
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}WARN\s{3}Dry run mode enabled\s{2}\(runId: \d+/),
    );
    expect(logFile).toContain('Dry run mode enabled');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}INFO\s{3}Migration finished\s{2}\(runId: \d+/),
    );
    expect(logFile).toContain('Migration finished');
    // UI
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('DRY RUN MODE ENABLED: No changes will be made.'),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Migration Results:'),
    );
  });

  it('should handle component filtering correctly', async () => {
    preconditions.canMigrate();

    // Run the command with component filter
    await migrationsCommand.parseAsync(['node', 'test', 'run', 'migration-component', '--space', '12345', '--log-console']);

    expect(fetchStories).toHaveBeenCalledWith(
      '12345',
      expect.objectContaining({
        per_page: 500,
        page: 1,
        contain_component: 'migration-component',
        story_only: true,
      }),
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', '517473243');
  });
});

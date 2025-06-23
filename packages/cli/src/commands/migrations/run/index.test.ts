import { beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../../session';
import { konsola } from '../../../utils';
// Import the main components module first to ensure proper initialization

import '../index';
import { migrationsCommand } from '../command';
import { readMigrationFiles } from './actions';
import { fetchStoriesByComponent, fetchStory, updateStory } from '../../stories/actions';
import { handleMigrations, summarizeMigrationResults } from './operations';
import type { Story } from '../../stories/constants';

vi.mock('../../../utils', async () => {
  const actualUtils = await vi.importActual('../../../utils');
  return {
    ...actualUtils,
    isVitestRunning: true,
    konsola: {
      ok: vi.fn(),
      title: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      br: vi.fn(),
    },
    handleError: (error: unknown, header = false) => {
      konsola.error(error as string, header);
      // Optionally, prevent process.exit during tests
    },
  };
});

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

  return {
    session,
  };
});

vi.mock('../../../commands/stories/actions', () => ({
  fetchStoriesByComponent: vi.fn(),
  fetchStory: vi.fn(),
  updateStory: vi.fn(),
}));

vi.mock('./actions', () => ({
  readJavascriptFile: vi.fn(),
  readMigrationFiles: vi.fn(),
  getMigrationFunction: vi.fn(),
  applyMigrationToAllBlocks: vi.fn(),
}));

vi.mock('./operations.ts', () => ({
  handleMigrations: vi.fn(),
  summarizeMigrationResults: vi.fn(),
}));

// Helper function to create mock stories
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

// Mock stories data
const mockStories: Story[] = [
  createMockStory({
    id: 517473243,
    name: 'Blog Post',
    uuid: 'uuid-1',
    slug: 'blog-post',
    full_slug: 'blog-post',
    published: true,
  }),
  createMockStory({
    id: 517473244,
    name: 'Draft Post',
    uuid: 'uuid-2',
    slug: 'draft-post',
    full_slug: 'draft-post',
    published: false,
    published_at: null,
    first_published_at: null,
  }),
];

const mockSingleStory = mockStories[0];

describe('migrations run command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should run migrations', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  // Example to change a string to boolean\n'
          + '  // block.field_name = !!(block.field_name)\n'
          + '\n'
          + '  // Example to transfer content from other field\n'
          + '  // block.target_field = block.source_field\n'
          + '\n'
          + '  // Example to transform an array\n'
          + '  // block.array_field = block.array_field.map(item => ({ ...item, new_prop: \'value\' }))\n'
          + '  /* block.amount = Number(block.amount) + 1;\n'
          + '  block.highlighted = !block.highlighted; */\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '\n'
          + '  return block;\n'
          + '}\n',
      },
      {
        name: 'migration-component.amount.js',
        content: 'export default function (block) {\n'
          + '  // Example to change a string to boolean\n'
          + '  // block.field_name = !!(block.field_name)\n'
          + '\n'
          + '  // Example to transfer content from other field\n'
          + '  // block.target_field = block.source_field\n'
          + '\n'
          + '  // Example to transform an array\n'
          + '  // block.array_field = block.array_field.map(item => ({ ...item, new_prop: \'value\' }))\n'
          + '  block.amount = Number(block.amount) + 1\n'
          + '  return block;\n'
          + '}\n',
      },
      {
        name: 'simple_component.js',
        content: 'export default function (block) {\n'
          + '  // Example to change a string to boolean\n'
          + '  // block.field_name = !!(block.field_name)\n'
          + '\n'
          + '  // Example to transfer content from other field\n'
          + '  // block.target_field = block.source_field\n'
          + '\n'
          + '  // Example to transform an array\n'
          + '  // block.array_field = block.array_field.map(item => ({ ...item, new_prop: \'value\' }))\n'
          + '  block.fullname = block.name + " " + block.lastname;\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Home',
          migrationName: 'migration-component.js',
          content: mockSingleStory.content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(
      mockMigrationFiles,
    );

    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);

    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);

    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);

    vi.mocked(updateStory).mockResolvedValue(mockSingleStory);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345']);

    expect(readMigrationFiles).toHaveBeenCalledWith({
      space: '12345',
      path: undefined,
      filter: undefined,
    });

    expect(fetchStoriesByComponent).toHaveBeenCalledWith(
      {
        spaceId: '12345',
        token: 'valid-token',
        region: 'eu',
      },
      {},
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', 'valid-token', 'eu', '517473243');
    expect(handleMigrations).toHaveBeenCalledWith({
      migrationFiles: mockMigrationFiles,
      stories: mockStories,
      space: '12345',
      path: undefined,
      componentName: undefined,
      password: 'valid-token',
      region: 'eu',
    });

    expect(summarizeMigrationResults).toHaveBeenCalledWith(mockMigrationResults);

    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473243,
      {
        story: {
          content: mockSingleStory.content,
          id: 517473243,
          name: 'Home',
        },
        force_update: '1',
      },
    );
  });

  it('should run migrations with a component name', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '  return block;\n'
          + '}\n',
      },
      {
        name: 'migration-component.amount.js',
        content: 'export default function (block) {\n'
          + '  block.amount = Number(block.amount) + 1\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Home',
          migrationName: 'migration-component.amount.js',
          content: mockSingleStory.content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);
    vi.mocked(updateStory).mockResolvedValue(mockSingleStory);

    await migrationsCommand.parseAsync(['node', 'test', 'run', 'migration-component', '--space', '12345']);

    expect(readMigrationFiles).toHaveBeenCalledWith({
      space: '12345',
      path: undefined,
      filter: undefined,
    });

    expect(fetchStoriesByComponent).toHaveBeenCalledWith(
      {
        spaceId: '12345',
        token: 'valid-token',
        region: 'eu',
      },
      {
        componentName: 'migration-component',
      },
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', 'valid-token', 'eu', '517473243');
    expect(handleMigrations).toHaveBeenCalledWith({
      migrationFiles: mockMigrationFiles,
      stories: mockStories,
      space: '12345',
      path: undefined,
      componentName: 'migration-component',
      password: 'valid-token',
      region: 'eu',
    });

    expect(summarizeMigrationResults).toHaveBeenCalledWith(mockMigrationResults);

    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473243,
      {
        story: {
          content: mockSingleStory.content,
          id: 517473243,
          name: 'Home',
        },
        force_update: '1',
      },
    );
  });

  it('should run migrations by filter', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.amount.js',
        content: 'export default function (block) {\n'
          + '  block.amount = Number(block.amount) + 1\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Home',
          migrationName: 'migration-component.amount.js',
          content: mockSingleStory.content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);
    vi.mocked(updateStory).mockResolvedValue(mockSingleStory);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--filter', '*.amount.js']);

    expect(readMigrationFiles).toHaveBeenCalledWith({
      space: '12345',
      path: undefined,
      filter: '*.amount.js',
    });

    expect(fetchStoriesByComponent).toHaveBeenCalledWith(
      {
        spaceId: '12345',
        token: 'valid-token',
        region: 'eu',
      },
      {},
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', 'valid-token', 'eu', '517473243');
    expect(handleMigrations).toHaveBeenCalledWith({
      migrationFiles: mockMigrationFiles,
      stories: mockStories,
      space: '12345',
      path: undefined,
      componentName: undefined,
      password: 'valid-token',
      region: 'eu',
    });

    expect(summarizeMigrationResults).toHaveBeenCalledWith(mockMigrationResults);

    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473243,
      {
        story: {
          content: mockSingleStory.content,
          id: 517473243,
          name: 'Home',
        },
        force_update: '1',
      },
    );
  });

  it('should run the migrations with a dry run', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Home',
          migrationName: 'migration-component.js',
          content: mockSingleStory.content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--dry-run']);

    // Key assertion: updateStory should not be called in dry run mode
    expect(updateStory).not.toHaveBeenCalled();
  });

  it('should not update stories when no successful migrations', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockMigrationResults = {
      successful: [],
      failed: [
        {
          storyId: 517473243,
          name: 'Home',
          migrationName: 'migration-component.js',
          error: 'Migration failed',
        },
      ],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345']);

    expect(readMigrationFiles).toHaveBeenCalledWith({
      space: '12345',
      path: undefined,
      filter: undefined,
    });

    expect(fetchStoriesByComponent).toHaveBeenCalledWith(
      {
        spaceId: '12345',
        token: 'valid-token',
        region: 'eu',
      },
      {},
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', 'valid-token', 'eu', '517473243');
    expect(handleMigrations).toHaveBeenCalledWith({
      migrationFiles: mockMigrationFiles,
      stories: mockStories,
      space: '12345',
      path: undefined,
      componentName: undefined,
      password: 'valid-token',
      region: 'eu',
    });

    expect(summarizeMigrationResults).toHaveBeenCalledWith(mockMigrationResults);

    // Key assertion: updateStory should not be called when there are no successful migrations
    expect(updateStory).not.toHaveBeenCalled();
    expect(konsola.info).toHaveBeenCalledWith('No stories were modified by the migrations.');
  });

  it('should run migrations with starts_with filter', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Blog Post',
          migrationName: 'migration-component.js',
          content: mockSingleStory.content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);
    vi.mocked(updateStory).mockResolvedValue(mockSingleStory);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--starts-with', '/en/blog/']);

    expect(readMigrationFiles).toHaveBeenCalledWith({
      space: '12345',
      path: undefined,
      filter: undefined,
    });

    expect(fetchStoriesByComponent).toHaveBeenCalledWith(
      {
        spaceId: '12345',
        token: 'valid-token',
        region: 'eu',
      },
      {
        starts_with: '/en/blog/',
      },
    );
    expect(fetchStory).toHaveBeenCalledWith('12345', 'valid-token', 'eu', '517473243');
    expect(handleMigrations).toHaveBeenCalledWith({
      migrationFiles: mockMigrationFiles,
      stories: mockStories,
      space: '12345',
      path: undefined,
      componentName: undefined,
      password: 'valid-token',
      region: 'eu',
    });

    expect(summarizeMigrationResults).toHaveBeenCalledWith(mockMigrationResults);

    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473243,
      {
        story: {
          content: mockSingleStory.content,
          id: 517473243,
          name: 'Blog Post',
        },
        force_update: '1',
      },
    );
  });

  it('should publish all stories when publish=all', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockStories = [
      {
        id: 517473243,
        name: 'Blog Post',
        uuid: 'uuid-1',
        slug: 'blog-post',
        full_slug: 'blog-post',
        content: {
          _uid: '4b16d1ea-4306-47c5-b901-9d67d5babf53',
          component: 'page',
          body: [
            {
              _uid: '216ba4ef-1298-4b7d-8ce0-7487e6db15cc',
              component: 'migration-component',
              unchanged: 'unchanged',
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
      },
      {
        id: 517473244,
        name: 'Draft Post',
        uuid: 'uuid-2',
        slug: 'draft-post',
        full_slug: 'draft-post',
        content: {
          _uid: '4b16d1ea-4306-47c5-b901-9d67d5babf54',
          component: 'page',
          body: [
            {
              _uid: '216ba4ef-1298-4b7d-8ce0-7487e6db15cd',
              component: 'migration-component',
              unchanged: 'unchanged',
            },
          ],
        },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        published_at: null,
        first_published_at: null,
        published: false,
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
      },
    ] as Story[];

    const mockSingleStory = mockStories[0];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Blog Post',
          migrationName: 'migration-component.js',
          content: mockSingleStory.content,
        },
        {
          storyId: 517473244,
          name: 'Draft Post',
          migrationName: 'migration-component.js',
          content: mockStories[1].content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);
    vi.mocked(updateStory).mockResolvedValue(mockSingleStory);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--publish', 'all']);

    // Verify that updateStory was called with publish=1 for all stories
    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473243,
      {
        story: {
          content: mockSingleStory.content,
          id: 517473243,
          name: 'Blog Post',
        },
        force_update: '1',
        publish: 1,
      },
    );

    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473244,
      {
        story: {
          content: mockStories[1].content,
          id: 517473244,
          name: 'Draft Post',
        },
        force_update: '1',
        publish: 1,
      },
    );
  });

  it('should only publish already published stories when publish=published', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockStories = [
      {
        id: 517473243,
        name: 'Published Post',
        uuid: 'uuid-1',
        slug: 'published-post',
        full_slug: 'published-post',
        content: {
          _uid: '4b16d1ea-4306-47c5-b901-9d67d5babf53',
          component: 'page',
          body: [
            {
              _uid: '216ba4ef-1298-4b7d-8ce0-7487e6db15cc',
              component: 'migration-component',
              unchanged: 'unchanged',
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
      },
      {
        id: 517473244,
        name: 'Draft Post',
        uuid: 'uuid-2',
        slug: 'draft-post',
        full_slug: 'draft-post',
        content: {
          _uid: '4b16d1ea-4306-47c5-b901-9d67d5babf54',
          component: 'page',
          body: [
            {
              _uid: '216ba4ef-1298-4b7d-8ce0-7487e6db15cd',
              component: 'migration-component',
              unchanged: 'unchanged',
            },
          ],
        },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        published_at: null,
        first_published_at: null,
        published: false,
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
      },
    ] as Story[];

    const mockSingleStory = mockStories[0];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Published Post',
          migrationName: 'migration-component.js',
          content: mockSingleStory.content,
        },
        {
          storyId: 517473244,
          name: 'Draft Post',
          migrationName: 'migration-component.js',
          content: mockStories[1].content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);
    vi.mocked(updateStory).mockResolvedValue(mockSingleStory);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--publish', 'published']);

    // Verify that updateStory was called with publish=1 only for published stories
    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473243,
      {
        story: {
          content: mockSingleStory.content,
          id: 517473243,
          name: 'Published Post',
        },
        force_update: '1',
        publish: 1,
      },
    );

    // Verify that updateStory was called without publish=1 for unpublished stories
    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473244,
      {
        story: {
          content: mockStories[1].content,
          id: 517473244,
          name: 'Draft Post',
        },
        force_update: '1',
      },
    );
  });

  it('should not publish any stories when publish option is not set', async () => {
    const mockMigrationFiles = [
      {
        name: 'migration-component.js',
        content: 'export default function (block) {\n'
          + '  block.unchanged = \'unchanged\';\n'
          + '  return block;\n'
          + '}\n',
      },
    ];

    const mockStories = [
      {
        id: 517473243,
        name: 'Published Post',
        uuid: 'uuid-1',
        slug: 'published-post',
        full_slug: 'published-post',
        content: {
          _uid: '4b16d1ea-4306-47c5-b901-9d67d5babf53',
          component: 'page',
          body: [
            {
              _uid: '216ba4ef-1298-4b7d-8ce0-7487e6db15cc',
              component: 'migration-component',
              unchanged: 'unchanged',
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
      },
    ] as Story[];

    const mockSingleStory = mockStories[0];

    const mockMigrationResults = {
      successful: [
        {
          storyId: 517473243,
          name: 'Published Post',
          migrationName: 'migration-component.js',
          content: mockSingleStory.content,
        },
      ],
      failed: [],
      skipped: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(readMigrationFiles).mockResolvedValue(mockMigrationFiles);
    vi.mocked(fetchStoriesByComponent).mockResolvedValue(mockStories);
    vi.mocked(fetchStory).mockResolvedValue(mockSingleStory);
    vi.mocked(handleMigrations).mockResolvedValue(mockMigrationResults);
    vi.mocked(updateStory).mockResolvedValue(mockSingleStory);

    await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345']);

    // Verify that updateStory was called without publish=1
    expect(updateStory).toHaveBeenCalledWith(
      '12345',
      'valid-token',
      'eu',
      517473243,
      {
        story: {
          content: mockSingleStory.content,
          id: 517473243,
          name: 'Published Post',
        },
        force_update: '1',
      },
    );
  });
});

import { session } from '../../../session';
import { CommandError, konsola } from '../../../utils';
import { generateMigration } from './actions';
// Import the main components module first to ensure proper initialization

import '../index';
import { migrationsCommand } from '../command';
import { fetchComponent } from '../../../commands/components';

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

vi.mock('../../../commands/components', () => ({
  fetchComponent: vi.fn(),
}));

vi.mock('./actions', () => ({
  generateMigration: vi.fn(),
}));

describe('migrations generate command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();

    // Reset the option values
    migrationsCommand._optionValues = {};
    migrationsCommand._optionValueSources = {};
    for (const command of migrationsCommand.commands) {
      command._optionValueSources = {};
      command._optionValues = {};
    }
  });

  it('should generate a migration', async () => {
    const mockComponent = {
      name: 'component-name',
      display_name: 'Component Name',
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
      id: 12345,
      schema: {
        field1: {
          type: 'bloks',
          restrict_type: 'tags',
          component_tag_whitelist: [1, 2],
        },
      },
      color: null,
      internal_tags_list: [],
      internal_tag_ids: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(fetchComponent).mockResolvedValue(mockComponent);

    await migrationsCommand.parseAsync(['node', 'test', 'generate', 'component-name', '--space', '12345']);

    expect(generateMigration).toHaveBeenCalledWith('12345', undefined, mockComponent, undefined);
    expect(konsola.ok).toHaveBeenCalledWith('You can find the migration file in .storyblok/migrations/12345/component-name.js');
  });

  it('should generate a migration with a path', async () => {
    const mockComponent = {
      name: 'component-name',
      display_name: 'Component Name',
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
      id: 12345,
      schema: {
        field1: {
          type: 'bloks',
          restrict_type: 'tags',
          component_tag_whitelist: [1, 2],
        },
      },
      color: null,
      internal_tags_list: [],
      internal_tag_ids: [],
    };

    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(fetchComponent).mockResolvedValue(mockComponent);

    await migrationsCommand.parseAsync(['node', 'test', 'generate', 'component-name', '--space', '12345', '--path', 'custom']);

    expect(generateMigration).toHaveBeenCalledWith('12345', 'custom', mockComponent, undefined);
    expect(konsola.ok).toHaveBeenCalledWith('You can find the migration file in custom/migrations/12345/component-name.js');
  });

  it('should throw an error if the component is not found', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(fetchComponent).mockResolvedValue(undefined);

    await migrationsCommand.parseAsync(['node', 'test', 'generate', 'component-name', '--space', '12345']);

    const mockError = new CommandError('No component found with name "component-name"');
    expect(konsola.error).toHaveBeenCalledWith(mockError, false);
  });

  it('should throw an error if the component name is not provided', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    const mockError = new CommandError('Please provide the component name as argument storyblok migrations generate YOUR_COMPONENT_NAME.');
    await migrationsCommand.parseAsync(['node', 'test', 'generate', '--space', '12345']);
    expect(konsola.error).toHaveBeenCalledWith(mockError, false);
  });
});

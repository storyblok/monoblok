import { session } from '../../../session';
import { konsola } from '../../../utils';
import { generateStoryblokTypes, generateTypes } from './actions';
import chalk from 'chalk';
import { colorPalette } from '../../../constants';
// Import the main components module first to ensure proper initialization
import '../index';
import { typesCommand } from '../command';
import { readComponentsFiles } from '../../components/push/actions';

vi.mock('./actions', () => ({
  generateStoryblokTypes: vi.fn(),
  generateTypes: vi.fn(),
  getComponentType: vi.fn(),
}));

vi.mock('../../components/push/actions', () => ({
  readComponentsFiles: vi.fn(),
}));

// Mocking the session module
vi.mock('../../../session', () => {
  let _cache: Record<string, any> | null = null;
  const session = () => {
    if (!_cache) {
      _cache = {
        state: {
          isLoggedIn: false,
        },
        updateSession: vi.fn(),
        persistCredentials: vi.fn(),
        initializeSession: vi.fn(),
      };
    }
    return _cache;
  };

  return {
    session,
  };
});

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

describe('types generate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    // Fix the linter errors by using a type assertion
    (typesCommand as any)._optionValues = {};
    (typesCommand as any)._optionValueSources = {};
    for (const command of typesCommand.commands) {
      (command as any)._optionValues = {};
      (command as any)._optionValueSources = {};
    }
  });

  describe('default mode', () => {
    it('should prompt the user if the operation was sucessfull', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }];

      const mockSpaceData = {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
      };

      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);

      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345']);

      expect(generateStoryblokTypes).toHaveBeenCalledWith({
        filename: undefined,
        path: undefined,
      });

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, {

      });

      expect(konsola.ok).toHaveBeenCalledWith(`Successfully generated types for space ${chalk.hex(colorPalette.PRIMARY)('12345')}`, true);
    });

    it('should pass strict mode option to generateTypes when --strict flag is used', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }];

      const mockSpaceData = {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
      };

      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      // Run the command with the --strict flag
      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--strict']);

      // Verify that generateTypes was called with the strict option set to true
      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, {
        strict: true,
      });
    });

    it('should pass typePrefix option to generateTypes when --type-prefix flag is used', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }];

      const mockSpaceData = {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
      };

      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      // Run the command with the --type-prefix flag
      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--type-prefix', 'Custom']);

      // Verify that generateTypes was called with the typePrefix option set to 'Custom'
      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, {
        typePrefix: 'Custom',
      });
    });

    it('should pass suffix option to generateTypes when --suffix flag is used', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }];

      const mockSpaceData = {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
      };

      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      // Run the command with the --suffix flag
      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--suffix', 'Component']);

      // Verify that generateTypes was called with the suffix option set to 'Component'
      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, {
        suffix: 'Component',
      });
    });

    it('should pass separateFiles option to generateTypes when --separate-files flag is used', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }];

      const mockSpaceData = {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
      };

      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      // Run the command with the --separate-files flag
      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--separate-files']);

      // Verify that generateTypes was called with the separateFiles option set to true
      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, {
        separateFiles: true,
      });
    });

    it('should pass customFieldsParser option to generateTypes when --custom-fields-parser flag is used', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }];

      const mockSpaceData = {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
      };

      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      // Run the command with the --custom-fields-parser flag
      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--custom-fields-parser', '/path/to/parser.ts']);

      // Verify that generateTypes was called with the customFieldsParser option set to '/path/to/parser.ts'
      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, {
        customFieldsParser: '/path/to/parser.ts',
      });
    });

    it('should pass compilerOptions option to generateTypes when --compiler-options flag is used', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }];

      const mockSpaceData = {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
      };

      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      // Run the command with the --compiler-options flag
      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--compiler-options', '/path/to/options.json']);

      // Verify that generateTypes was called with the compilerOptions option set to '/path/to/options.json'
      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, {
        compilerOptions: '/path/to/options.json',
      });
    });
  });
});

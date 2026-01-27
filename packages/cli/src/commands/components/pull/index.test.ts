import { beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../../session';
import { CommandError, konsola } from '../../../utils';
import { fetchComponent, fetchComponents, saveComponentsToFiles } from './actions';
import chalk from 'chalk';
import { colorPalette } from '../../../constants';
// Import the main module first to ensure proper initialization
import '../index';
import { componentsCommand } from '../command';
import { loggedOutSessionState } from '../../../../test/setup';

vi.mock('./actions', () => ({
  fetchComponents: vi.fn(),
  fetchComponent: vi.fn(),
  fetchComponentGroups: vi.fn(),
  fetchComponentPresets: vi.fn(),
  fetchComponentInternalTags: vi.fn(),
  saveComponentsToFiles: vi.fn(),
}));

vi.mock('../../../utils/konsola');

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe('pull', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    // Reset the option values
    (componentsCommand as any)._optionValues = {};
    (componentsCommand as any)._optionValueSources = {};
    for (const command of componentsCommand.commands) {
      (command as any)._optionValueSources = {};
      (command as any)._optionValues = {};
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
        color: undefined,
        internal_tags_list: [] as { id?: number; name?: string }[],
        internal_tag_ids: [] as string[],
      }, {
        name: 'component-name-2',
        display_name: 'Component Name 2',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12346,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [] as { id?: number; name?: string }[],
        internal_tag_ids: [] as string[],
      }];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

      expect(fetchComponents).toHaveBeenCalledWith('12345');
      expect(saveComponentsToFiles).toHaveBeenCalledWith('12345', {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
        datasources: [],
      }, {
        path: undefined,
        separateFiles: false,
      });
      expect(konsola.ok).toHaveBeenCalledWith(`Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/components/12345/components.json`)}`);
    });

    it('should fetch a component by name', async () => {
      const mockResponse = {
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      };
      vi.mocked(fetchComponent).mockResolvedValue(mockResponse);
      await componentsCommand.parseAsync(['node', 'test', 'pull', 'component-name', '--space', '12345']);
      expect(fetchComponent).toHaveBeenCalledWith('12345', 'component-name');
      expect(saveComponentsToFiles).toHaveBeenCalledWith('12345', {
        components: [mockResponse],
        groups: [],
        presets: [],
        internalTags: [],
        datasources: [],
      }, { separateFiles: true, path: undefined });
    });

    it('should throw an error if the component is not found', async () => {
      const componentName = 'component-name';
      vi.mocked(fetchComponent).mockResolvedValue(undefined);
      await componentsCommand.parseAsync(['node', 'test', 'pull', 'component-name', '--space', '12345']);
      expect(konsola.warn).toHaveBeenCalledWith(`No component found with name "${componentName}"`);
    });

    it('should throw an error if the user is not logged in', async () => {
      preconditions.loggedOut();
      await componentsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);
      expect(konsola.error).toHaveBeenCalledWith('You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.', null, {
        header: true,
      });
    });

    it('should throw an error if the space is not provided', async () => {
      const mockError = new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`);

      await componentsCommand.parseAsync(['node', 'test', 'pull']);
      expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
        header: true,
      });
    });
  });

  describe('--path option', () => {
    it('should save the file at the provided path', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [] as { id?: number; name?: string }[],
        internal_tag_ids: [] as string[],
      }];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--path', '/path/to/components']);
      expect(fetchComponents).toHaveBeenCalledWith('12345');
      expect(saveComponentsToFiles).toHaveBeenCalledWith('12345', {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
        datasources: [],
      }, { path: '/path/to/components', separateFiles: false });
      expect(konsola.ok).toHaveBeenCalledWith(`Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`/path/to/components/components/12345/components.json`)}`);
    });
  });

  describe('--filename option', () => {
    it('should save the file with the custom filename', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [] as { id?: number; name?: string }[],
        internal_tag_ids: [] as string[],
      }];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--filename', 'custom']);
      expect(fetchComponents).toHaveBeenCalledWith('12345');
      expect(saveComponentsToFiles).toHaveBeenCalledWith('12345', {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
        datasources: [],
      }, { filename: 'custom', separateFiles: false });
      expect(konsola.ok).toHaveBeenCalledWith(`Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/components/12345/custom.json`)}`);
    });
  });

  describe('--separate-files option', () => {
    it('should save each component in a separate file', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }, {
        name: 'component-name-2',
        display_name: 'Component Name 2',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12346,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--separate-files']);
      expect(fetchComponents).toHaveBeenCalledWith('12345');
      expect(saveComponentsToFiles).toHaveBeenCalledWith('12345', {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
        datasources: [],
      }, { separateFiles: true, path: undefined });
      expect(konsola.ok).toHaveBeenCalledWith(`Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/components/12345/`)}`);
    });

    it('should warn the user if the --filename is used along', async () => {
      const mockResponse = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--separate-files', '--filename', 'custom']);
      expect(fetchComponents).toHaveBeenCalledWith('12345');
      expect(saveComponentsToFiles).toHaveBeenCalledWith('12345', {
        components: mockResponse,
        groups: [],
        presets: [],
        internalTags: [],
        datasources: [],
      }, { separateFiles: true, filename: 'custom' });
      expect(konsola.warn).toHaveBeenCalledWith(`The --filename option is ignored when using --separate-files`);
    });
  });
});

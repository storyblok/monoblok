import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../../session';
import { CommandError, konsola } from '../../../utils';
import { vol } from 'memfs';
import type { SpaceDatasource } from '../constants';
// Import the main module first to ensure proper initialization
import '../index';
import { datasourcesCommand } from '../command';
import { loggedOutSessionState } from '../../../../test/setup';

vi.mock('./actions', async () => {
  const actual = await vi.importActual('./actions');
  return {
    ...actual,
    pushDatasource: vi.fn(),
    updateDatasource: vi.fn(),
    upsertDatasource: vi.fn().mockResolvedValue({ id: 1, name: 'test' }),
    pushDatasourceEntry: vi.fn(),
    updateDatasourceEntry: vi.fn(),
    upsertDatasourceEntry: vi.fn(),
  };
});

vi.mock('../pull/actions', () => ({
  fetchDatasources: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/konsola');

const mockDatasource: SpaceDatasource = {
  id: 1,
  name: 'test-datasource',
  slug: 'test-datasource',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  dimensions: [],
  entries: [],
};

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe('push datasources', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    // Reset the option values
    (datasourcesCommand as any)._optionValues = {};
    (datasourcesCommand as any)._optionValueSources = {};
    for (const command of datasourcesCommand.commands) {
      (command as any)._optionValueSources = {};
      (command as any)._optionValues = {};
    }
  });

  afterEach(() => {
    vol.reset();
  });

  describe('default mode', () => {
    it('should use target space as from space when --from option is not provided', async () => {
      // Create mock filesystem with datasources for the target space
      vol.fromJSON({
        '.storyblok/datasources/12345/datasources.json': JSON.stringify([mockDatasource]),
      });

      await datasourcesCommand.parseAsync(['node', 'test', 'push', '--space', '12345']);

      // The readDatasourcesFiles should have been called and should read from space 12345
      // Since we're reading from the same space as we're pushing to
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('from') && expect.stringContaining('12345'));
    });

    it('should use the --from option when provided', async () => {
      // Create mock filesystem with datasources for the source space
      vol.fromJSON({
        '.storyblok/datasources/source-space/datasources.json': JSON.stringify([mockDatasource]),
      });

      await datasourcesCommand.parseAsync(['node', 'test', 'push', '--space', 'target-space', '--from', 'source-space']);

      // The command should indicate pushing from source-space to target-space
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('source-space'));
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('target-space'));
    });

    it('should throw an error if the user is not logged in', async () => {
      preconditions.loggedOut();

      await datasourcesCommand.parseAsync(['node', 'test', 'push', '--space', '12345']);

      expect(konsola.error).toHaveBeenCalledWith(
        'You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.',
        null,
        {
          header: true,
        },
      );
    });

    it('should throw an error if the space is not provided', async () => {
      const mockError = new CommandError(`Please provide the target space as argument --space TARGET_SPACE_ID.`);

      await datasourcesCommand.parseAsync(['node', 'test', 'push']);

      expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
        header: true,
      });
    });
  });

  describe('--separate-files option', () => {
    it('should read from separate files when specified', async () => {
      // Create mock filesystem with separate files
      vol.fromJSON({
        '.storyblok/datasources/12345/test-datasource.json': JSON.stringify([mockDatasource]),
      });

      await datasourcesCommand.parseAsync(['node', 'test', 'push', '--space', '12345', '--separate-files']);

      // Should proceed without errors if files are found
      expect(konsola.info).toHaveBeenCalled();
    });
  });
});

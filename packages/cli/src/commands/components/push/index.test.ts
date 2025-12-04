import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../../session';
import { CommandError, konsola } from '../../../utils';
import { vol } from 'memfs';
import type { SpaceComponent } from '../constants';
// Import the main module first to ensure proper initialization
import '../index';
import { componentsCommand } from '../command';

// Mock filesystem modules
vi.mock('node:fs');
vi.mock('node:fs/promises');

vi.mock('./actions', async () => {
  const actual = await vi.importActual('./actions');
  return {
    ...actual,
    pushComponent: vi.fn(),
    updateComponent: vi.fn(),
    upsertComponent: vi.fn(),
    pushComponentGroup: vi.fn(),
    updateComponentGroup: vi.fn(),
    upsertComponentGroup: vi.fn(),
    pushComponentPreset: vi.fn(),
    updateComponentPreset: vi.fn(),
    upsertComponentPreset: vi.fn(),
    pushComponentInternalTag: vi.fn(),
    updateComponentInternalTag: vi.fn(),
    upsertComponentInternalTag: vi.fn(),
  };
});

vi.mock('../actions', () => ({
  fetchComponents: vi.fn().mockResolvedValue([]),
  fetchComponentGroups: vi.fn().mockResolvedValue([]),
  fetchComponentPresets: vi.fn().mockResolvedValue([]),
  fetchComponentInternalTags: vi.fn().mockResolvedValue([]),
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

vi.mock('../../../utils/konsola');

const mockComponent: SpaceComponent = {
  name: 'test-component',
  display_name: 'Test Component',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 1,
  schema: { type: 'object' },
  is_root: false,
  is_nestable: true,
  all_presets: [],
  real_name: 'test-component',
  internal_tags_list: [],
  internal_tag_ids: [],
};

describe('push', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    // Reset the option values
    (componentsCommand as any)._optionValues = {};
    (componentsCommand as any)._optionValueSources = {};
    for (const command of componentsCommand.commands) {
      (command as any)._optionValueSources = {};
      (command as any)._optionValues = {};
    }
  });

  afterEach(() => {
    vol.reset();
  });

  describe('default mode', () => {
    it('should use target space as from space when --from option is not provided', async () => {
      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      // Create mock filesystem with components for the target space
      vol.fromJSON({
        '.storyblok/components/12345/components.json': JSON.stringify([mockComponent]),
      });

      await componentsCommand.parseAsync(['node', 'test', 'push', '--space', '12345']);

      // The readComponentsFiles should have been called and should read from space 12345
      // Since we're reading from the same space as we're pushing to
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('from') && expect.stringContaining('12345'));
    });

    it('should use the --from option when provided', async () => {
      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      // Create mock filesystem with components for the source space
      vol.fromJSON({
        '.storyblok/components/source-space/components.json': JSON.stringify([mockComponent]),
      });

      await componentsCommand.parseAsync(['node', 'test', 'push', '--space', 'target-space', '--from', 'source-space']);

      // The command should indicate pushing from source-space to target-space
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('source-space'));
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('target-space'));
    });

    it('should throw an error if the user is not logged in', async () => {
      session().state = {
        isLoggedIn: false,
      };

      await componentsCommand.parseAsync(['node', 'test', 'push', '--space', '12345']);

      expect(konsola.error).toHaveBeenCalledWith(
        'You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.',
        null,
        {
          header: true,
        },
      );
    });

    it('should throw an error if the space is not provided', async () => {
      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      const mockError = new CommandError(`Please provide the target space as argument --space TARGET_SPACE_ID.`);

      await componentsCommand.parseAsync(['node', 'test', 'push']);

      expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
        header: true,
      });
    });
  });

  describe('--separate-files option', () => {
    it('should read from separate files when specified', async () => {
      session().state = {
        isLoggedIn: true,
        password: 'valid-token',
        region: 'eu',
      };

      // Create mock filesystem with separate files
      vol.fromJSON({
        '.storyblok/components/12345/test-component.json': JSON.stringify([mockComponent]),
      });

      await componentsCommand.parseAsync(['node', 'test', 'push', '--space', '12345', '--separate-files']);

      // Should proceed without errors if files are found
      expect(konsola.info).toHaveBeenCalled();
    });
  });
});

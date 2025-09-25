import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { PluginManager } from './manager';
import type { PluginSource } from './types';
import * as filesystemUtils from '../utils/filesystem';

// Mock filesystem utilities
vi.mock('../utils/filesystem', () => ({
  getStoryblokGlobalPath: vi.fn(() => '/mock-home/.storyblok'),
  readJsonFile: vi.fn(),
  saveToFile: vi.fn(),
  readFile: vi.fn(),
  copyDirectory: vi.fn(),
  removeDirectory: vi.fn(),
}));

// Mock fs operations
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    copyFile: vi.fn(),
    rm: vi.fn(),
  },
}));

// Mock konsola
vi.mock('../utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    konsola: {
      info: vi.fn(),
      warn: vi.fn(),
      ok: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('pluginManager', () => {
  let pluginManager: PluginManager;
  const mockFs = fs as any;
  const mockFilesystemUtils = filesystemUtils as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the plugin manager instance to ensure clean state
    (PluginManager as any).instance = undefined;

    // Setup default mock behaviors
    mockFilesystemUtils.readJsonFile.mockResolvedValue({ data: [] }); // Empty registry by default
    mockFs.mkdir.mockResolvedValue(undefined);

    pluginManager = PluginManager.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create plugins directory and load registry', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      await pluginManager.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('plugins'),
        { recursive: true },
      );
    });

    it('should load existing registry if it exists', async () => {
      const mockRegistry = {
        plugins: {},
        version: '1.0.0',
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFilesystemUtils.readJsonFile.mockResolvedValue({ data: [mockRegistry] });

      await pluginManager.initialize();

      expect(mockFilesystemUtils.readJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('plugins-registry.json'),
      );
    });
  });

  describe('plugin installation', () => {
    it('should extract correct plugin name from local path', () => {
      const source: PluginSource = {
        type: 'local',
        location: '/path/to/my-plugin',
      };

      const pluginName = (pluginManager as any).extractPluginName(source);
      expect(pluginName).toBe('my-plugin');
    });

    it('should handle plugin installation workflow', async () => {
      const mockManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        main: 'index.js',
      };

      mockFs.rm.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
      mockFilesystemUtils.readJsonFile.mockResolvedValue({ data: [mockManifest] });
      mockFilesystemUtils.saveToFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      const source: PluginSource = {
        type: 'local',
        location: '/path/to/test-plugin',
      };

      // Mock filesystem utils and plugin loading
      vi.mocked(filesystemUtils.copyDirectory).mockResolvedValue(undefined);
      vi.spyOn(pluginManager as any, 'loadPlugin').mockResolvedValue(undefined);

      await pluginManager.installPlugin(source);

      expect(filesystemUtils.removeDirectory).toHaveBeenCalled(); // Remove existing installation
      expect(mockFilesystemUtils.saveToFile).toHaveBeenCalled(); // Save registry
    });
  });

  describe('plugin listing', () => {
    it('should return empty array when no plugins installed', () => {
      const plugins = pluginManager.listPlugins();
      expect(plugins).toEqual([]);
    });
  });

  describe('plugin uninstallation', () => {
    it('should throw error when trying to uninstall non-existent plugin', async () => {
      await expect(pluginManager.uninstallPlugin('non-existent')).rejects.toThrow(
        'Plugin \'non-existent\' is not installed',
      );
    });
  });

  describe('loadManifest', () => {
    it('should load manifest from plugin.json', async () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        commands: [
          {
            name: 'test',
            description: 'Test command',
            action: vi.fn(),
          },
        ],
        hooks: {
          init: './hooks/init.js',
          prerun: ['./hooks/prerun.js'],
        },
      };

      vi.mocked(filesystemUtils.readJsonFile).mockResolvedValueOnce({
        data: [manifest],
        error: undefined,
      });

      const result = await (pluginManager as any).loadManifest('/test-plugin');

      expect(result).toEqual(manifest);
      expect(filesystemUtils.readJsonFile).toHaveBeenCalledWith('/test-plugin/plugin.json');
    });

    it('should load manifest from package.json with storyblok key', async () => {
      const packageJson = {
        name: 'my-storyblok-plugin',
        version: '2.0.0',
        dependencies: {
          'some-dep': '^1.0.0',
        },
        storyblok: {
          name: 'package-plugin',
          description: 'Plugin from package.json',
          commands: [
            {
              name: 'pkg-test',
              description: 'Package test command',
              action: vi.fn(),
            },
          ],
        },
      };

      // Mock plugin.json not found, then package.json found
      vi.mocked(filesystemUtils.readJsonFile)
        .mockResolvedValueOnce({ data: [], error: new Error('File not found') })
        .mockResolvedValueOnce({ data: [packageJson], error: undefined });

      const result = await (pluginManager as any).loadManifest('/package-plugin');

      expect(result).toEqual({
        name: 'package-plugin',
        version: '2.0.0',
        commands: packageJson.storyblok.commands,
        hooks: [],
      });
    });

    it('should prefer plugin.json over package.json when both exist', async () => {
      const pluginJson = {
        name: 'priority-plugin',
        version: '1.0.0',
        description: 'From plugin.json',
        commands: [],
      };

      vi.mocked(filesystemUtils.readJsonFile).mockResolvedValueOnce({
        data: [pluginJson],
        error: undefined,
      });

      const result = await (pluginManager as any).loadManifest('/priority-plugin');

      expect(result).toEqual(pluginJson);
      expect(filesystemUtils.readJsonFile).toHaveBeenCalledWith('/priority-plugin/plugin.json');
      expect(filesystemUtils.readJsonFile).toHaveBeenCalledTimes(1);
    });

    it('should return null when no valid manifest is found', async () => {
      vi.mocked(filesystemUtils.readJsonFile)
        .mockResolvedValueOnce({ data: [], error: new Error('File not found') })
        .mockResolvedValueOnce({ data: [], error: new Error('File not found') });

      const result = await (pluginManager as any).loadManifest('/empty-plugin');

      expect(result).toBeNull();
    });

    it('should return null when package.json exists but has no storyblok key', async () => {
      const packageJson = {
        name: 'regular-package',
        version: '1.0.0',
        dependencies: {},
      };

      vi.mocked(filesystemUtils.readJsonFile)
        .mockResolvedValueOnce({ data: [], error: new Error('File not found') })
        .mockResolvedValueOnce({ data: [packageJson], error: undefined });

      const result = await (pluginManager as any).loadManifest('/regular-package');

      expect(result).toBeNull();
    });
  });

  describe('hooks', () => {
    it('should register and run hooks', async () => {
      const hookFn = vi.fn().mockResolvedValueOnce(undefined);

      // Register a hook
      (pluginManager as any).registerHook('test-hook', hookFn);

      // Run the hook
      await pluginManager.runHook('test-hook', { testData: 'value' });

      expect(hookFn).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.any(Object),
          testData: 'value',
        }),
      );
    });

    it('should run multiple hooks in parallel', async () => {
      const hook1 = vi.fn().mockResolvedValueOnce(undefined);
      const hook2 = vi.fn().mockResolvedValueOnce(undefined);

      (pluginManager as any).registerHook('multi-hook', hook1);
      (pluginManager as any).registerHook('multi-hook', hook2);

      await pluginManager.runHook('multi-hook');

      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
    });

    it('should handle hook errors gracefully', async () => {
      const failingHook = vi.fn().mockRejectedValueOnce(new Error('Hook failed'));
      const successHook = vi.fn().mockResolvedValueOnce(undefined);

      (pluginManager as any).registerHook('error-hook', failingHook);
      (pluginManager as any).registerHook('error-hook', successHook);

      // Should not throw, but log warning and continue
      await expect(pluginManager.runHook('error-hook')).resolves.not.toThrow();

      expect(failingHook).toHaveBeenCalled();
      expect(successHook).toHaveBeenCalled();
    });
  });
});

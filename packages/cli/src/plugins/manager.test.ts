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

      // Mock the copy directory method
      vi.spyOn(pluginManager as any, 'copyDirectory').mockResolvedValue(undefined);
      vi.spyOn(pluginManager as any, 'loadPlugin').mockResolvedValue(undefined);

      await pluginManager.installPlugin(source);

      expect(mockFs.rm).toHaveBeenCalled(); // Remove existing installation
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
});

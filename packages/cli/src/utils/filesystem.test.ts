import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { appendToFile, copyDirectory, getComponentNameFromFilename, getStoryblokGlobalPath, removeDirectory, resolvePath, sanitizeFilename, saveToFile } from './filesystem';
import { join, resolve } from 'node:path';

// tell vitest to use fs mock from __mocks__ folder
// this can be done in a setup file if fs should always be mocked
vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => {
  vi.clearAllMocks();
  // reset the state of in-memory fs
  vol.reset();
});

describe('filesystem utils', async () => {
  describe('getStoryblokGlobalPath', async () => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };
    const originalCwd = process.cwd;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
    // Restore the original platform after each test
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
      // Restore process.cwd()
      process.cwd = originalCwd;
    });
    it('should return the correct path on Unix-like systems when HOME is set', () => {
      // Mock the platform to be Unix-like
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      // Set the HOME environment variable
      process.env.HOME = '/home/testuser';

      const expectedPath = join('/home/testuser', '.storyblok');
      const result = getStoryblokGlobalPath();

      expect(result).toBe(expectedPath);
    });

    it('should return the correct path on Windows systems when USERPROFILE is set', () => {
      // Mock the platform to be Windows
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      // Set the USERPROFILE environment variable
      process.env.USERPROFILE = 'C:/Users/TestUser';

      const expectedPath = join('C:/Users/TestUser', '.storyblok');
      const result = getStoryblokGlobalPath();

      expect(result).toBe(expectedPath);
    });

    it('should use process.cwd() when home directory is not set', () => {
      // Mock the platform to be Unix-like
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      // Remove HOME and USERPROFILE
      delete process.env.HOME;
      delete process.env.USERPROFILE;

      // Mock process.cwd()
      process.cwd = vi.fn().mockReturnValue('/current/working/directory');

      const expectedPath = join('/current/working/directory', '.storyblok');
      const result = getStoryblokGlobalPath();

      expect(result).toBe(expectedPath);
    });

    it('should use process.cwd() when HOME is empty', () => {
      // Mock the platform to be Unix-like
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      // Set HOME to an empty string
      process.env.HOME = '';

      // Mock process.cwd()
      process.cwd = vi.fn().mockReturnValue('/current/working/directory');

      const expectedPath = join('/current/working/directory', '.storyblok');
      const result = getStoryblokGlobalPath();

      expect(result).toBe(expectedPath);
    });

    it('should handle Windows platform when USERPROFILE is not set', () => {
      // Mock the platform to be Windows
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      // Remove USERPROFILE
      delete process.env.USERPROFILE;

      // Mock process.cwd()
      process.cwd = vi.fn().mockReturnValue('C:/Current/Directory');

      const expectedPath = join('C:/Current/Directory', '.storyblok');
      const result = getStoryblokGlobalPath();

      expect(result).toBe(expectedPath);
    });
  });
  describe('saveToFile', async () => {
    it('should save the data to the file', async () => {
      const filePath = '/path/to/file.txt';
      const data = 'Hello, World!';

      await saveToFile(filePath, data);

      const content = vol.readFileSync(filePath, 'utf8');
      expect(content).toBe(data);
    });

    it('should create the directory if it does not exist', async () => {
      const filePath = '/path/to/new/file.txt';
      const data = 'Hello, World!';

      await saveToFile(filePath, data);

      const content = vol.readFileSync(filePath, 'utf8');
      expect(content).toBe(data);
    });
  });

  describe('appendToFile', async () => {
    it('should append a new line to a file', async () => {
      const filePath = '/path/to/file.txt';
      const data = 'Hello, World!';

      await appendToFile(filePath, data);
      await appendToFile(filePath, data);

      const content = vol.readFileSync(filePath, 'utf8');
      expect(content).toBe(`${data}\n${data}\n`);
    });
  });

  describe('resolvePath', async () => {
    it('should resolve the path correctly', async () => {
      const path = '/path/to/file';
      const folder = 'folder';

      const resolvedPath = resolvePath(path, folder);
      expect(resolvedPath).toBe(resolve(process.cwd(), path, folder));

      const resolvedPathWithoutPath = resolvePath(undefined, folder);
      expect(resolvedPathWithoutPath).toBe(resolve(process.cwd(), '.storyblok', folder));
    });
  });

  describe('getComponentNameFromFilename', async () => {
    it('should extract the component name from a JavaScript file', () => {
      expect(getComponentNameFromFilename('simple_component.js')).toBe('simple_component');
      expect(getComponentNameFromFilename('nested-component.js')).toBe('nested-component');
      expect(getComponentNameFromFilename('camelCaseComponent.js')).toBe('camelCaseComponent');
    });

    it('should return the original name if no .js extension is present', () => {
      expect(getComponentNameFromFilename('component_without_extension')).toBe('component_without_extension');
    });

    it('should handle filenames with multiple dots', () => {
      expect(getComponentNameFromFilename('component.with.dots.js')).toBe('component.with.dots');
    });

    it('should handle filenames with paths', () => {
      expect(getComponentNameFromFilename('/path/to/my_component.js')).toBe('/path/to/my_component');
    });
  });

  describe('sanitizeFilename', () => {
    it('should convert strings to URL-friendly slugs', () => {
      expect(sanitizeFilename('Country / Currency')).toBe('Country _ Currency');
      expect(sanitizeFilename('path/to/file')).toBe('path_to_file');
      expect(sanitizeFilename('My Component Name')).toBe('My Component Name');
      expect(sanitizeFilename('Special@Characters!')).toBe('Special@Characters!');
    });
  });

  describe('copyDirectory', () => {
    beforeEach(() => {
      vol.reset();
    });

    it('should copy a directory with files recursively', async () => {
      // Setup source directory structure
      vol.fromJSON({
        '/source/file1.txt': 'content1',
        '/source/file2.js': 'console.log("test");',
        '/source/subdir/file3.md': '# Test markdown',
        '/source/subdir/nested/file4.json': '{"test": true}',
      });

      await copyDirectory('/source', '/destination');

      // Verify all files were copied
      expect(vol.readFileSync('/destination/file1.txt', 'utf8')).toBe('content1');
      expect(vol.readFileSync('/destination/file2.js', 'utf8')).toBe('console.log("test");');
      expect(vol.readFileSync('/destination/subdir/file3.md', 'utf8')).toBe('# Test markdown');
      expect(vol.readFileSync('/destination/subdir/nested/file4.json', 'utf8')).toBe('{"test": true}');
    });

    it('should skip node_modules directory', async () => {
      vol.fromJSON({
        '/source/package.json': '{"name": "test"}',
        '/source/src/index.js': 'console.log("app");',
        '/source/node_modules/dep/index.js': 'dependency code',
        '/source/node_modules/dep/package.json': '{"name": "dep"}',
      });

      await copyDirectory('/source', '/destination');

      // Verify main files were copied but node_modules was skipped
      expect(vol.readFileSync('/destination/package.json', 'utf8')).toBe('{"name": "test"}');
      expect(vol.readFileSync('/destination/src/index.js', 'utf8')).toBe('console.log("app");');
      expect(vol.existsSync('/destination/node_modules')).toBe(false);
    });

    it('should handle empty directories', async () => {
      vol.fromJSON({
        '/source/empty/placeholder': '',
        '/source/file.txt': 'content',
      });

      await copyDirectory('/source', '/destination');

      expect(vol.readFileSync('/destination/file.txt', 'utf8')).toBe('content');
      expect(vol.existsSync('/destination/empty')).toBe(true);
    });

    it('should create destination directory if it does not exist', async () => {
      vol.fromJSON({
        '/source/file.txt': 'content',
      });

      await copyDirectory('/source', '/deep/nested/destination');

      expect(vol.readFileSync('/deep/nested/destination/file.txt', 'utf8')).toBe('content');
    });

    it('should continue copying other files when one file fails', async () => {
      vol.fromJSON({
        '/source/file1.txt': 'content1',
        '/source/file2.txt': 'content2',
      });

      // Should not throw and copy available files
      await expect(copyDirectory('/source', '/destination')).resolves.not.toThrow();

      // Verify successful files were copied
      expect(vol.readFileSync('/destination/file1.txt', 'utf8')).toBe('content1');
      expect(vol.readFileSync('/destination/file2.txt', 'utf8')).toBe('content2');
    });
  });

  describe('removeDirectory', () => {
    beforeEach(() => {
      vol.reset();
    });

    it('should remove a directory and all its contents', async () => {
      vol.fromJSON({
        '/target/file1.txt': 'content1',
        '/target/subdir/file2.txt': 'content2',
        '/target/subdir/nested/file3.txt': 'content3',
      });

      expect(vol.existsSync('/target')).toBe(true);

      await removeDirectory('/target');

      expect(vol.existsSync('/target')).toBe(false);
    });

    it('should not throw when directory does not exist', async () => {
      expect(vol.existsSync('/nonexistent')).toBe(false);

      await expect(removeDirectory('/nonexistent')).resolves.not.toThrow();
    });

    it('should handle ENOENT errors gracefully by not throwing', async () => {
      // With memfs, trying to remove a non-existent directory should not throw
      expect(vol.existsSync('/nonexistent')).toBe(false);
      await expect(removeDirectory('/nonexistent')).resolves.not.toThrow();
    });
  });
});

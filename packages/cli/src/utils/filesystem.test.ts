import { vol } from 'memfs';
import { getComponentNameFromFilename, getStoryblokGlobalPath, resolvePath, saveToFile } from './filesystem';
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
});

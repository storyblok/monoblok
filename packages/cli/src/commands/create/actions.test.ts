import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import open from 'open';
import { createEnvFile, extractPortFromTopics, fetchBlueprintRepositories, generateProject, generateSpaceUrl, openSpaceInBrowser, repositoryToTemplate } from './actions';
import * as filesystem from '../../utils/filesystem';

// Mock external dependencies
vi.mock('node:child_process');
vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(),
  },
}));
vi.mock('open');
vi.mock('../../utils/filesystem');
// Mock github module for fetchBlueprintRepositories tests
vi.mock('../../github', () => ({
  createOctokit: vi.fn(),
}));
// Mock utils module for error handling
vi.mock('../../utils', () => ({
  handleAPIError: vi.fn(),
}));

const mockedSpawn = vi.mocked(spawn);
const mockedOpen = open as MockedFunction<typeof open>;
const mockedSaveToFile = filesystem.saveToFile as MockedFunction<typeof filesystem.saveToFile>;
const mockedFsAccess = vi.mocked(fs.access);

// Import the mocked modules
const { createOctokit } = await import('../../github');
const { handleAPIError } = await import('../../utils');
const mockedCreateOctokit = vi.mocked(createOctokit);
const mockedHandleAPIError = vi.mocked(handleAPIError);

describe('create actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateProject', () => {
    it('should generate project successfully when directory does not exist', async () => {
      // Mock fs.access to throw ENOENT (directory doesn't exist)
      const accessError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockedFsAccess.mockRejectedValueOnce(accessError);

      // Mock successful spawn process
      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            // Simulate successful completion
            setTimeout(() => callback(0), 0);
          }
        }),
      };
      mockedSpawn.mockReturnValue(mockProcess as any);

      await expect(generateProject('react', 'my-project', '/test/path')).resolves.toBeUndefined();

      expect(mockedFsAccess).toHaveBeenCalledWith('/test/path/my-project');
      expect(mockedSpawn).toHaveBeenCalledWith(
        'npx',
        ['degit', 'storyblok/blueprint-core-react', '/test/path/my-project'],
        {
          stdio: 'inherit',
          shell: true,
        },
      );
    });

    it('should throw FileSystemError when directory already exists', async () => {
      // Mock fs.access to succeed (directory exists)
      mockedFsAccess.mockResolvedValueOnce(undefined);

      await expect(generateProject('vue', 'existing-project')).rejects.toThrow(
        expect.objectContaining({
          name: 'File System Error',
          errorId: 'directory_not_empty',
          code: 'ENOTEMPTY',
        }),
      );

      expect(mockedFsAccess).toHaveBeenCalledWith(expect.stringContaining('existing-project'));
    });

    it('should handle filesystem errors other than ENOENT', async () => {
      // Mock fs.access to throw EACCES (permission denied)
      const accessError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      accessError.code = 'EACCES';
      mockedFsAccess.mockRejectedValueOnce(accessError);

      await expect(generateProject('svelte', 'test-project')).rejects.toThrow(
        expect.objectContaining({
          name: 'File System Error',
          errorId: 'permission_denied',
        }),
      );
    });

    it('should handle spawn process failure', async () => {
      // Mock fs.access to throw ENOENT (directory doesn't exist)
      const accessError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockedFsAccess.mockRejectedValueOnce(accessError);

      // Mock failed spawn process
      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            // Simulate failure
            setTimeout(() => callback(1), 0);
          }
        }),
      };
      mockedSpawn.mockReturnValue(mockProcess as any);

      await expect(generateProject('react', 'failed-project')).rejects.toThrow(
        'Failed to clone template. Process exited with code 1',
      );
    });

    it('should handle spawn process error', async () => {
      // Mock fs.access to throw ENOENT (directory doesn't exist)
      const accessError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockedFsAccess.mockRejectedValueOnce(accessError);

      // Mock spawn process error
      const mockProcess = {
        on: vi.fn((event: string, callback: (error: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('spawn failed')), 0);
          }
        }),
      };
      mockedSpawn.mockReturnValue(mockProcess as any);

      await expect(generateProject('react', 'error-project')).rejects.toThrow(
        'Failed to spawn degit process: spawn failed',
      );
    });

    it('should use current working directory as default target path', async () => {
      const accessError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockedFsAccess.mockRejectedValueOnce(accessError);

      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };
      mockedSpawn.mockReturnValue(mockProcess as any);

      vi.spyOn(process, 'cwd').mockReturnValue('/current/dir');

      await generateProject('react', 'my-project');

      expect(mockedFsAccess).toHaveBeenCalledWith('/current/dir/my-project');

      vi.mocked(process.cwd).mockRestore();
    });
  });

  describe('createEnvFile', () => {
    it('should create .env file successfully with access token only', async () => {
      mockedSaveToFile.mockResolvedValue(undefined);

      await createEnvFile('/test/project', 'test-token-123');

      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('STORYBLOK_DELIVERY_API_TOKEN=test-token-123'),
      );
    });

    it('should create .env file with additional variables', async () => {
      mockedSaveToFile.mockResolvedValue(undefined);

      const additionalVars = {
        CUSTOM_VAR: 'custom-value',
        ANOTHER_VAR: 'another-value',
      };

      await createEnvFile('/test/project', 'test-token-123', additionalVars);

      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringMatching(/STORYBLOK_DELIVERY_API_TOKEN=test-token-123/),
      );
      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringMatching(/CUSTOM_VAR=custom-value/),
      );
      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringMatching(/ANOTHER_VAR=another-value/),
      );
    });

    it('should handle filesystem errors when creating .env file', async () => {
      const saveError = new Error('Permission denied');
      mockedSaveToFile.mockRejectedValue(saveError);

      await expect(createEnvFile('/test/project', 'test-token')).rejects.toThrow(
        'Failed to create .env file: Permission denied',
      );
    });

    it('should create proper .env file content structure', async () => {
      mockedSaveToFile.mockResolvedValue(undefined);

      await createEnvFile('/test/project', 'test-token-123', { CUSTOM: 'value' });

      const [[, content]] = mockedSaveToFile.mock.calls;

      expect(content).toMatch(/^# Storyblok Configuration/);
      expect(content).toMatch(/STORYBLOK_DELIVERY_API_TOKEN=test-token-123/);
      expect(content).toMatch(/# Additional Configuration/);
      expect(content).toMatch(/CUSTOM=value/);
    });
  });

  describe('generateSpaceUrl', () => {
    it('should generate correct URL for EU region', () => {
      const url = generateSpaceUrl(12345, 'eu');
      expect(url).toBe('https://app.storyblok.com/#/me/spaces/12345/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create');
    });

    it('should generate correct URL for US region', () => {
      const url = generateSpaceUrl(67890, 'us');
      expect(url).toBe('https://app-us.storyblok.com/#/me/spaces/67890/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create');
    });

    it('should generate correct URL for China region', () => {
      const url = generateSpaceUrl(11111, 'cn');
      expect(url).toBe('https://app.storyblokchina.cn/#/me/spaces/11111/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create');
    });

    it('should generate correct URL for Canada region', () => {
      const url = generateSpaceUrl(22222, 'ca');
      expect(url).toBe('https://app-ca.storyblok.com/#/me/spaces/22222/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create');
    });

    it('should generate correct URL for Asia Pacific region', () => {
      const url = generateSpaceUrl(33333, 'ap');
      expect(url).toBe('https://app-ap.storyblok.com/#/me/spaces/33333/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create');
    });
  });

  describe('openSpaceInBrowser', () => {
    it('should open space URL in browser successfully', async () => {
      mockedOpen.mockResolvedValue({} as any);

      await expect(openSpaceInBrowser(12345, 'eu')).resolves.toBeUndefined();

      expect(mockedOpen).toHaveBeenCalledWith('https://app.storyblok.com/#/me/spaces/12345/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create');
    });

    it('should handle errors when opening browser fails', async () => {
      const openError = new Error('Failed to open browser');
      mockedOpen.mockRejectedValue(openError);

      await expect(openSpaceInBrowser(12345, 'us')).rejects.toThrow(
        'Failed to open space in browser: Failed to open browser',
      );
    });

    it('should open correct URL for different regions', async () => {
      mockedOpen.mockResolvedValue({} as any);

      await openSpaceInBrowser(98765, 'cn');

      expect(mockedOpen).toHaveBeenCalledWith('https://app.storyblokchina.cn/#/me/spaces/98765/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create');
    });
  });
});

describe('extractPortFromTopics', () => {
  it('should extract a valid port from topics', () => {
    // This topic array contains a valid port topic
    const topics = ['foo', 'bar', 'port-8080', 'baz'];
    expect(extractPortFromTopics(topics)).toBe('8080');
  });

  it('should return default port if no port topic is found', () => {
    // No port topic present, should fallback to 3000
    const topics = ['foo', 'bar', 'baz'];
    expect(extractPortFromTopics(topics)).toBe('3000');
  });

  it('should return default port if port is invalid', () => {
    // Port topic is not a valid number
    const topics = ['port-abc', 'foo'];
    expect(extractPortFromTopics(topics)).toBe('3000');
  });

  it('should return default port if port is out of range', () => {
    // Port is too high
    const topics = ['port-70000'];
    expect(extractPortFromTopics(topics)).toBe('3000');
  });
});

describe('repositoryToTemplate', () => {
  it('should convert a repo object to a DynamicTemplate', () => {
    // Mock repo object with expected fields
    const repo = {
      name: 'blueprint-core-vue',
      topics: ['port-5173'],
      clone_url: 'https://github.com/storyblok/blueprint-core-vue.git',
      description: 'A Vue starter',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const template = repositoryToTemplate(repo);
    expect(template).toEqual({
      name: 'Vue',
      value: 'vue',
      template: 'https://github.com/storyblok/blueprint-core-vue.git',
      location: 'https://localhost:5173/',
      description: 'A Vue starter',
      updated_at: '2024-01-01T00:00:00Z',
    });
  });

  it('should fallback to default port if no port topic', () => {
    const repo = {
      name: 'blueprint-core-react',
      topics: [],
      clone_url: 'https://github.com/storyblok/blueprint-core-react.git',
      description: 'A React starter',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const template = repositoryToTemplate(repo);
    expect(template.location).toBe('https://localhost:3000/');
  });
});

describe('fetchBlueprintRepositories', () => {
  it('should fetch and map repositories to blueprints', async () => {
    // Mock Octokit and its response
    const mockRepos = [
      {
        name: 'blueprint-core-vue',
        topics: ['port-5173'],
        clone_url: 'https://github.com/storyblok/blueprint-core-vue.git',
        description: 'A Vue starter',
        updated_at: '2024-01-01T00:00:00Z',
        stargazers_count: 50,
      },
      {
        name: 'blueprint-core-react',
        topics: ['port-3000'],
        clone_url: 'https://github.com/storyblok/blueprint-core-react.git',
        description: 'A React starter',
        updated_at: '2024-01-02T00:00:00Z',
        stargazers_count: 75,
      },
      // Should be filtered out - not a blueprint
      {
        name: 'not-a-blueprint',
        topics: [],
        clone_url: '',
        description: '',
        updated_at: '',
      },
    ];

    const mockOctokit = {
      rest: {
        search: {
          repos: vi.fn().mockResolvedValue({ data: { items: mockRepos } }),
        },
      },
    };

    // Mock createOctokit to return our mockOctokit
    mockedCreateOctokit.mockReturnValue(mockOctokit as any);

    const blueprints = await fetchBlueprintRepositories();

    // Verify GitHub API was called correctly
    expect(mockedCreateOctokit).toHaveBeenCalled();
    expect(mockOctokit.rest.search.repos).toHaveBeenCalledWith({
      q: 'org:storyblok blueprint-core-',
      sort: 'updated',
      order: 'desc',
      per_page: 100,
    });

    // Only blueprint-core-* repos should be mapped and sorted alphabetically
    expect(blueprints).toHaveLength(2);
    expect(blueprints?.[0]?.name).toBe('React');
    expect(blueprints?.[1]?.name).toBe('Vue');

    // Verify blueprint structure
    expect(blueprints?.[0]).toEqual({
      name: 'React',
      value: 'react',
      template: 'https://github.com/storyblok/blueprint-core-react.git',
      location: 'https://localhost:3000/',
      description: 'A React starter',
      updated_at: '2024-01-02T00:00:00Z',
      stars: 75,
    });
  });

  it('should handle errors and call handleAPIError', async () => {
    // Mock createOctokit to throw an error
    const octokitError = new Error('GitHub API error');
    mockedCreateOctokit.mockImplementation(() => {
      throw octokitError;
    });

    await fetchBlueprintRepositories();

    // Verify error handling was called
    expect(mockedHandleAPIError).toHaveBeenCalledWith(
      'fetch_blueprints',
      octokitError,
      'Failed to fetch blueprints from GitHub',
    );
  });
});

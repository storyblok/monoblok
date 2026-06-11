import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { vol } from 'memfs';
import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import open from 'open';
import { createEnvFile, extractPortFromTopics, fetchBlueprintRepositories, generateProject, handleEnvFileCreation, openSpaceInBrowser, repositoryToTemplate } from './actions';
import * as filesystem from '../../utils/filesystem';
import type { RegionCode } from '../../constants';
import { appDomains } from '../../constants';

vi.mock('node:child_process');
vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(),
  },
}));
vi.mock('open');
vi.mock('../../utils/filesystem');
vi.mock('../../github', () => ({
  createOctokit: vi.fn(),
}));
const { mockedUI } = vi.hoisted(() => ({
  mockedUI: {
    ok: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../utils/ui', () => ({
  getUI: vi.fn(() => mockedUI),
}));

const mockedSpawn = vi.mocked(spawn);
const mockedOpen = open as MockedFunction<typeof open>;
const mockedSaveToFile = filesystem.saveToFile as MockedFunction<typeof filesystem.saveToFile>;
const mockedFsAccess = vi.mocked(fs.access);

// Import the mocked modules
const { createOctokit } = await import('../../github');
const mockedCreateOctokit = vi.mocked(createOctokit);

describe('create actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
  });

  describe('generateProject', () => {
    it('should generate project successfully when directory does not exist', async () => {
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
      const accessError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockedFsAccess.mockRejectedValueOnce(accessError);

      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
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
      const accessError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockedFsAccess.mockRejectedValueOnce(accessError);

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

      await createEnvFile('/test/project', { STORYBLOK_DELIVERY_API_TOKEN: 'test-token-123' });

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

      await createEnvFile('/test/project', { STORYBLOK_DELIVERY_API_TOKEN: 'test-token-123' }, additionalVars);

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

      await expect(createEnvFile('/test/project', { STORYBLOK_DELIVERY_API_TOKEN: 'test-token-123' })).rejects.toThrow(
        'Failed to create .env file: Permission denied',
      );
    });

    it('should create proper .env file content structure', async () => {
      mockedSaveToFile.mockResolvedValue(undefined);

      await createEnvFile('/test/project', { STORYBLOK_DELIVERY_API_TOKEN: 'test-token-123' }, { CUSTOM: 'value' });

      const [[, content]] = mockedSaveToFile.mock.calls;

      expect(content).toMatch(/^# Storyblok Configuration/);
      expect(content).toMatch(/STORYBLOK_DELIVERY_API_TOKEN=test-token-123/);
      expect(content).toMatch(/# Additional Configuration/);
      expect(content).toMatch(/CUSTOM=value/);
    });
  });

  describe('handleEnvFileCreation', () => {
    it('should create .env file with token and region successfully', async () => {
      mockedSaveToFile.mockResolvedValue(undefined);

      const result = await handleEnvFileCreation('/test/project', 'test-token-123', 'us');

      expect(result).toBe(true);
      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('STORYBLOK_DELIVERY_API_TOKEN=test-token-123'),
      );
      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('STORYBLOK_REGION=us'),
      );
      expect(mockedUI.ok).toHaveBeenCalledWith(expect.stringContaining('Created .env file with'), true);
    });

    it('should create .env file with only token', async () => {
      mockedSaveToFile.mockResolvedValue(undefined);

      const result = await handleEnvFileCreation('/test/project', 'test-token-456');

      expect(result).toBe(true);
      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('STORYBLOK_DELIVERY_API_TOKEN=test-token-456'),
      );
      expect(mockedUI.ok).toHaveBeenCalledWith(
        expect.stringContaining('Created .env file with'),
        true,
      );
    });

    it('should create .env file with only region', async () => {
      mockedSaveToFile.mockResolvedValue(undefined);

      const result = await handleEnvFileCreation('/test/project', undefined, 'ap');

      expect(result).toBe(true);
      expect(mockedSaveToFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('STORYBLOK_REGION=ap'),
      );
      expect(mockedUI.ok).toHaveBeenCalledWith(expect.stringContaining('Created .env file with'), true);
    });

    it('should return true and log info when no environment variables provided', async () => {
      const result = await handleEnvFileCreation('/test/project');

      expect(result).toBe(true);
      expect(mockedUI.info).toHaveBeenCalledWith('No environment variables to write');
      expect(mockedSaveToFile).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and return false', async () => {
      const saveError = new Error('Permission denied');
      mockedSaveToFile.mockRejectedValue(saveError);

      const result = await handleEnvFileCreation('/test/project', 'test-token-789', 'eu');

      expect(result).toBe(false);
      expect(mockedUI.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create .env file: Permission denied'),
      );
      expect(mockedUI.info).toHaveBeenCalledWith(
        expect.stringContaining('You can manually add STORYBLOK_DELIVERY_API_TOKEN'),
      );
      expect(mockedUI.info).toHaveBeenCalledWith(
        expect.stringContaining('You can manually add STORYBLOK_REGION'),
      );
    });

    it('should show only token message when only token fails', async () => {
      const saveError = new Error('Disk full');
      mockedSaveToFile.mockRejectedValue(saveError);

      const result = await handleEnvFileCreation('/test/project', 'test-token');

      expect(result).toBe(false);
      expect(mockedUI.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create .env file'),
      );
      expect(mockedUI.info).toHaveBeenCalledWith(
        expect.stringContaining('You can manually add STORYBLOK_DELIVERY_API_TOKEN'),
      );
      expect(mockedUI.info).not.toHaveBeenCalledWith(
        expect.stringContaining('You can manually add STORYBLOK_REGION'),
      );
    });

    it('should show only region message when only region fails', async () => {
      const saveError = new Error('Access denied');
      mockedSaveToFile.mockRejectedValue(saveError);

      const result = await handleEnvFileCreation('/test/project', undefined, 'ca');

      expect(result).toBe(false);
      expect(mockedUI.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create .env file'),
      );
      expect(mockedUI.info).not.toHaveBeenCalledWith(
        expect.stringContaining('You can manually add STORYBLOK_DELIVERY_API_TOKEN'),
      );
      expect(mockedUI.info).toHaveBeenCalledWith(
        expect.stringContaining('You can manually add STORYBLOK_REGION'),
      );
    });
  });

  it('should contain the correct region domains', () => {
    expect(appDomains).toEqual({
      eu: 'app.storyblok.com',
      us: 'app.storyblok.com',
      cn: 'app.storyblokchina.cn/fe/editor_v2',
      ca: 'app.storyblok.com',
      ap: 'app.storyblok.com',
    });
  });

  describe('openSpaceInBrowser', () => {
    const testCases = [
      { region: 'eu', spaceId: 12345 },
      { region: 'us', spaceId: 67890 },
      { region: 'cn', spaceId: 11111 },
      { region: 'ca', spaceId: 22222 },
      { region: 'ap', spaceId: 33333 },
    ] satisfies Array<{ region: RegionCode; spaceId: number }>;

    it.each(testCases)(
      'should open the correct URL for %s region',
      async ({ region, spaceId }) => {
        mockedOpen.mockResolvedValue({} as any);

        await expect(openSpaceInBrowser(spaceId, region)).resolves.toBeUndefined();

        expect(mockedOpen).toHaveBeenCalledWith(
          `https://${appDomains[region]}/#/me/spaces/${spaceId}/dashboard?utm_source=storyblok-cli&utm_medium=cli&utm_campaign=create`,
        );
      },
    );

    it('should handle errors when opening browser fails', async () => {
      const openError = new Error('Failed to open browser');
      mockedOpen.mockRejectedValue(openError);

      await expect(openSpaceInBrowser(12345, 'us')).rejects.toThrow(
        'Failed to open space in browser: Failed to open browser',
      );
    });
  });
});

describe('extractPortFromTopics', () => {
  it('should extract a valid port from topics', () => {
    const topics = ['foo', 'bar', 'port-8080', 'baz'];
    expect(extractPortFromTopics(topics)).toBe('8080');
  });

  it('should return default port if no port topic is found', () => {
    const topics = ['foo', 'bar', 'baz'];
    expect(extractPortFromTopics(topics)).toBe('3000');
  });

  it('should return default port if port is invalid', () => {
    const topics = ['port-abc', 'foo'];
    expect(extractPortFromTopics(topics)).toBe('3000');
  });

  it('should return default port if port is out of range', () => {
    const topics = ['port-70000'];
    expect(extractPortFromTopics(topics)).toBe('3000');
  });
});

describe('repositoryToTemplate', () => {
  it('should convert a repo object to a DynamicTemplate', () => {
    const repo = {
      name: 'blueprint-core-vue',
      topics: ['port-5173'],
      clone_url: 'https://github.com/storyblok/blueprint-core-vue.git',
      description: 'A Vue starter',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const template = repositoryToTemplate(repo as any);
    expect(template).toEqual({
      name: 'Vue',
      value: 'vue',
      template: 'https://github.com/storyblok/blueprint-core-vue.git',
      location: 'https://localhost:5173/',
      description: 'A Vue starter',
      updated_at: '2024-01-01T00:00:00Z',
    });
  });

  it('should fallback to default port if no port topic and no static template match', () => {
    const repo = {
      name: 'blueprint-core-unknown',
      topics: [],
      clone_url: 'https://github.com/storyblok/blueprint-core-unknown.git',
      description: 'An unknown starter',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const template = repositoryToTemplate(repo as any);
    expect(template.location).toBe('https://localhost:3000/');
  });

  it('should use static template location when available', () => {
    const repo = {
      name: 'blueprint-core-react',
      topics: [],
      clone_url: 'https://github.com/storyblok/blueprint-core-react.git',
      description: 'A React starter',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const template = repositoryToTemplate(repo as any);
    expect(template.location).toBe('https://localhost:5173/');
  });
});

describe('fetchBlueprintRepositories', () => {
  it('should fetch and map repositories to blueprints', async () => {
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

    mockedCreateOctokit.mockReturnValue(mockOctokit as any);

    const blueprints = await fetchBlueprintRepositories();

    expect(mockedCreateOctokit).toHaveBeenCalled();
    expect(mockOctokit.rest.search.repos).toHaveBeenCalledWith({
      q: 'org:storyblok blueprint-core-',
      sort: 'updated',
      order: 'desc',
      per_page: 100,
    });

    expect(blueprints).toHaveLength(2);
    expect(blueprints?.[0]?.name).toBe('React');
    expect(blueprints?.[1]?.name).toBe('Vue');

    expect(blueprints?.[0]).toEqual({
      name: 'React',
      value: 'react',
      template: 'https://github.com/storyblok/blueprint-core-react.git',
      location: 'https://localhost:5173/', // From static templates
      description: 'A React starter',
      updated_at: '2024-01-02T00:00:00Z',
      stars: 75,
    });
  });

  it('should handle errors and call show warning', async () => {
    const octokitError = new Error('GitHub API error');
    mockedCreateOctokit.mockImplementation(() => {
      throw octokitError;
    });

    await fetchBlueprintRepositories();
    expect(mockedUI.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch blueprints from GitHub. Using offline template list.'),
    );
  });

  it('should return static templates as fallback when GitHub API fails', async () => {
    const octokitError = new Error('GitHub API error');
    mockedCreateOctokit.mockImplementation(() => {
      throw octokitError;
    });

    const blueprints = await fetchBlueprintRepositories();

    expect(blueprints).toBeDefined();
    expect(blueprints.length).toBeGreaterThan(0);
    expect(blueprints.some(bp => bp.value === 'react')).toBe(true);
    expect(blueprints.some(bp => bp.value === 'vue')).toBe(true);
    expect(blueprints.some(bp => bp.value === 'nuxt')).toBe(true);
  });
});

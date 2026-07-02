import { spawn } from 'node:child_process';
import { vol } from 'memfs';
import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import open from 'open';
import { createEnvFile, extractPortFromTopics, fetchBlueprintRepositories, generateProject, handleEnvFileCreation, openSpaceInBrowser, repositoryToTemplate, updateAngularEnvironmentFiles } from './actions';
import type { RegionCode } from '../../constants';
import { appDomains } from '../../constants';

vi.mock('node:child_process');
vi.mock('open');
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
      // Directory does not exist - vol is empty
      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };
      mockedSpawn.mockReturnValue(mockProcess as any);

      await expect(generateProject('react', 'my-project', '/test/path')).resolves.toBeUndefined();

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
      // Create existing directory in memfs
      vol.fromJSON({
        '/test/path/existing-project/.gitkeep': '',
      });

      await expect(generateProject('vue', 'existing-project', '/test/path')).rejects.toThrow(
        expect.objectContaining({
          name: 'File System Error',
          errorId: 'directory_not_empty',
          code: 'ENOTEMPTY',
        }),
      );
    });

    it('should handle spawn process failure', async () => {
      // Directory does not exist - vol is empty
      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
        }),
      };
      mockedSpawn.mockReturnValue(mockProcess as any);

      await expect(generateProject('react', 'failed-project', '/test/path')).rejects.toThrow(
        'Failed to clone template. Process exited with code 1',
      );
    });

    it('should handle spawn process error', async () => {
      // Directory does not exist - vol is empty
      const mockProcess = {
        on: vi.fn((event: string, callback: (error: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('spawn failed')), 0);
          }
        }),
      };
      mockedSpawn.mockReturnValue(mockProcess as any);

      await expect(generateProject('react', 'error-project', '/test/path')).rejects.toThrow(
        'Failed to spawn degit process: spawn failed',
      );
    });

    it('should use current working directory as default target path', async () => {
      // Directory does not exist - vol is empty
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

      expect(mockedSpawn).toHaveBeenCalledWith(
        'npx',
        ['degit', 'storyblok/blueprint-core-react', '/current/dir/my-project'],
        {
          stdio: 'inherit',
          shell: true,
        },
      );

      vi.mocked(process.cwd).mockRestore();
    });
  });

  describe('createEnvFile', () => {
    it('should create .env file successfully with access token only', async () => {
      vol.fromJSON({
        '/test/project/.gitkeep': '',
      });

      await createEnvFile('/test/project', { STORYBLOK_DELIVERY_API_TOKEN: 'test-token-123' });

      const content = vol.readFileSync('/test/project/.env', 'utf-8');
      expect(content).toContain('STORYBLOK_DELIVERY_API_TOKEN=test-token-123');
    });

    it('should create .env file with additional variables', async () => {
      vol.fromJSON({
        '/test/project/.gitkeep': '',
      });

      const additionalVars = {
        CUSTOM_VAR: 'custom-value',
        ANOTHER_VAR: 'another-value',
      };

      await createEnvFile('/test/project', { STORYBLOK_DELIVERY_API_TOKEN: 'test-token-123' }, additionalVars);

      const content = vol.readFileSync('/test/project/.env', 'utf-8');
      expect(content).toMatch(/STORYBLOK_DELIVERY_API_TOKEN=test-token-123/);
      expect(content).toMatch(/CUSTOM_VAR=custom-value/);
      expect(content).toMatch(/ANOTHER_VAR=another-value/);
    });

    it('should create proper .env file content structure', async () => {
      vol.fromJSON({
        '/test/project/.gitkeep': '',
      });

      await createEnvFile('/test/project', { STORYBLOK_DELIVERY_API_TOKEN: 'test-token-123' }, { CUSTOM: 'value' });

      const content = vol.readFileSync('/test/project/.env', 'utf-8');
      expect(content).toMatch(/^# Storyblok Configuration/);
      expect(content).toMatch(/STORYBLOK_DELIVERY_API_TOKEN=test-token-123/);
      expect(content).toMatch(/# Additional Configuration/);
      expect(content).toMatch(/CUSTOM=value/);
    });
  });

  describe('handleEnvFileCreation', () => {
    it('should create .env file with token and region successfully', async () => {
      vol.fromJSON({
        '/test/project/.gitkeep': '',
      });

      const result = await handleEnvFileCreation('/test/project', 'test-token-123', 'us');

      expect(result).toBe(true);
      const content = vol.readFileSync('/test/project/.env', 'utf-8');
      expect(content).toContain('STORYBLOK_DELIVERY_API_TOKEN=test-token-123');
      expect(content).toContain('STORYBLOK_REGION=us');
      expect(mockedUI.ok).toHaveBeenCalledWith(expect.stringContaining('Created .env file with'), true);
    });

    it('should create .env file with only token', async () => {
      vol.fromJSON({
        '/test/project/.gitkeep': '',
      });

      const result = await handleEnvFileCreation('/test/project', 'test-token-456');

      expect(result).toBe(true);
      const content = vol.readFileSync('/test/project/.env', 'utf-8');
      expect(content).toContain('STORYBLOK_DELIVERY_API_TOKEN=test-token-456');
      expect(mockedUI.ok).toHaveBeenCalledWith(
        expect.stringContaining('Created .env file with'),
        true,
      );
    });

    it('should create .env file with only region', async () => {
      vol.fromJSON({
        '/test/project/.gitkeep': '',
      });

      const result = await handleEnvFileCreation('/test/project', undefined, 'ap');

      expect(result).toBe(true);
      const content = vol.readFileSync('/test/project/.env', 'utf-8');
      expect(content).toContain('STORYBLOK_REGION=ap');
      expect(mockedUI.ok).toHaveBeenCalledWith(expect.stringContaining('Created .env file with'), true);
    });

    it('should return true and log info when no environment variables provided', async () => {
      const result = await handleEnvFileCreation('/test/project');

      expect(result).toBe(true);
      expect(mockedUI.info).toHaveBeenCalledWith('No environment variables to write');
    });
  });

  describe('updateAngularEnvironmentFiles', () => {
    const angularEnvTemplate = `export const environment = {
  production: true,
  accessToken: 'STORYBLOK_DELIVERY_API_TOKEN', // Replace with your Storyblok Delivery API token
  region: 'STORYBLOK_REGION', // Replace with your Storyblok region
};`;

    it('should replace both token and region placeholders', async () => {
      vol.fromJSON({
        '/test/project/src/environments/environment.ts': angularEnvTemplate,
        '/test/project/src/environments/environment.development.ts': angularEnvTemplate,
      });

      const result = await updateAngularEnvironmentFiles('/test/project', 'my-actual-token', 'eu');

      expect(result.updatedFiles).toEqual([
        '/test/project/src/environments/environment.ts',
        '/test/project/src/environments/environment.development.ts',
      ]);

      const envContent = vol.readFileSync('/test/project/src/environments/environment.ts', 'utf-8');
      expect(envContent).toContain('accessToken: \'my-actual-token\'');
      expect(envContent).toContain('region: \'eu\'');

      const devEnvContent = vol.readFileSync('/test/project/src/environments/environment.development.ts', 'utf-8');
      expect(devEnvContent).toContain('accessToken: \'my-actual-token\'');
      expect(devEnvContent).toContain('region: \'eu\'');
    });

    it('should replace only token placeholder when region not provided', async () => {
      vol.fromJSON({
        '/test/project/src/environments/environment.ts': angularEnvTemplate,
        '/test/project/src/environments/environment.development.ts': angularEnvTemplate,
      });

      await updateAngularEnvironmentFiles('/test/project', 'my-token');

      const content = vol.readFileSync('/test/project/src/environments/environment.ts', 'utf-8');
      expect(content).toContain('accessToken: \'my-token\'');
      // Region placeholder should remain unchanged
      expect(content).toContain('STORYBLOK_REGION');
    });

    it('should replace only region placeholder when token not provided', async () => {
      vol.fromJSON({
        '/test/project/src/environments/environment.ts': angularEnvTemplate,
        '/test/project/src/environments/environment.development.ts': angularEnvTemplate,
      });

      await updateAngularEnvironmentFiles('/test/project', undefined, 'us');

      const content = vol.readFileSync('/test/project/src/environments/environment.ts', 'utf-8');
      expect(content).toContain('region: \'us\'');
      // Token placeholder should remain unchanged
      expect(content).toContain('STORYBLOK_DELIVERY_API_TOKEN');
    });

    it('should skip missing environment files silently and return empty array', async () => {
      // No files exist in memfs
      const result = await updateAngularEnvironmentFiles('/test/project', 'token', 'eu');

      expect(result.updatedFiles).toEqual([]);
    });

    it('should return only the files that exist', async () => {
      vol.fromJSON({
        '/test/project/src/environments/environment.ts': angularEnvTemplate,
        // environment.development.ts does not exist
      });

      const result = await updateAngularEnvironmentFiles('/test/project', 'token', 'eu');

      expect(result.updatedFiles).toEqual(['/test/project/src/environments/environment.ts']);
    });
  });

  describe('handleEnvFileCreation for Angular', () => {
    const angularEnvTemplate = `export const environment = {
  production: true,
  accessToken: 'STORYBLOK_DELIVERY_API_TOKEN',
  region: 'STORYBLOK_REGION',
};`;

    it('should update Angular environment files when template is angular', async () => {
      vol.fromJSON({
        '/test/project/src/environments/environment.ts': angularEnvTemplate,
        '/test/project/src/environments/environment.development.ts': angularEnvTemplate,
      });

      const result = await handleEnvFileCreation('/test/project', 'my-token', 'eu', 'angular');

      expect(result).toBe(true);
      expect(mockedUI.ok).toHaveBeenCalledWith(
        expect.stringContaining('Updated Angular environment files'),
        true,
      );
      // Verify files were actually updated
      const content = vol.readFileSync('/test/project/src/environments/environment.ts', 'utf-8');
      expect(content).toContain('accessToken: \'my-token\'');
      expect(content).toContain('region: \'eu\'');
    });

    it('should return true and log info when no vars provided for angular', async () => {
      const result = await handleEnvFileCreation('/test/project', undefined, undefined, 'angular');

      expect(result).toBe(true);
      expect(mockedUI.info).toHaveBeenCalledWith('No environment variables to write');
    });

    it('should log info when environment files do not exist', async () => {
      // No Angular environment files exist
      const result = await handleEnvFileCreation('/test/project', 'token', 'eu', 'angular');

      expect(result).toBe(true);
      expect(mockedUI.info).toHaveBeenCalledWith(
        'No Angular environment files found to update',
      );
    });

    it('should create .env file for non-angular templates', async () => {
      vol.fromJSON({
        '/test/project/.gitkeep': '',
      });

      const result = await handleEnvFileCreation('/test/project', 'token', 'eu', 'react');

      expect(result).toBe(true);
      const content = vol.readFileSync('/test/project/.env', 'utf-8');
      expect(content).toContain('STORYBLOK_DELIVERY_API_TOKEN=token');
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

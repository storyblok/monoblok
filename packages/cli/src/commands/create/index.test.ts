import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCommand } from './';
import { handleError, konsola, requireAuthentication, toHumanReadable } from '../../utils';
import { input, select } from '@inquirer/prompts';

import { createSpace } from '../spaces';
import type { Space } from '../spaces/actions';
import { mapiClient } from '../../api';
import { createEnvFile, fetchBlueprintRepositories, generateProject, generateSpaceUrl, openSpaceInBrowser } from './actions';
import { getUser } from '../user/actions';
import type { StoryblokUser } from '../../types';
import { templates } from './constants';

// Mock all dependencies
vi.mock('./actions', () => ({
  generateProject: vi.fn(),
  createEnvFile: vi.fn(),
  generateSpaceUrl: vi.fn(),
  openSpaceInBrowser: vi.fn(),
  fetchBlueprintRepositories: vi.fn(),
}));

vi.mock('../spaces', () => ({
  createSpace: vi.fn(),
}));

vi.mock('../user/actions', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../api', () => ({
  mapiClient: vi.fn(),
}));

vi.mock('../../session', () => {
  let _cache: Record<string, any> | null = null;
  const session = () => {
    if (!_cache) {
      _cache = {
        state: {
          isLoggedIn: true,
          password: 'test-token',
          region: 'eu',
        },
        initializeSession: vi.fn(),
      };
    }
    return _cache;
  };

  return {
    session,
  };
});

vi.mock('../../utils/konsola');
vi.mock('../../utils', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, any>;
  return {
    ...actual,
    requireAuthentication: vi.fn(),
    handleError: vi.fn(),
    toHumanReadable: vi.fn(),
    konsola: {
      ok: vi.fn(),
      title: vi.fn(),
      br: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    isVitest: true,
  };
});

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
}));

// Helper function to create a complete Space mock object
const createMockSpace = (overrides: Partial<Space> = {}): Space => ({
  name: 'Test Space',
  domain: 'test-domain.com',
  uniq_domain: 'test-uniq-domain',
  plan: 'starter',
  plan_level: 1,
  limits: {},
  created_at: '2024-01-01T00:00:00Z',
  id: 12345,
  role: 'admin',
  owner_id: 1,
  story_published_hook: '',
  environments: [],
  stories_count: 0,
  parent_id: 0,
  assets_count: 0,
  searchblok_id: 0,
  duplicatable: false,
  request_count_today: 0,
  exceeded_requests: 0,
  billing_address: {},
  routes: [],
  trial: false,
  default_root: '',
  has_slack_webhook: false,
  has_pending_tasks: false,
  ai_translation_disabled: false,
  first_token: 'space-token-123',
  options: {},
  collaborator: [],
  owner: {},
  ...overrides,
});

// Helper function to create a complete StoryblokUser mock object
const createMockUser = (overrides: Partial<StoryblokUser> = {}): StoryblokUser => ({
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  friendly_name: 'Test User',
  otp_required: false,
  access_token: 'test-token',
  has_org: false,
  org: {
    name: 'Test Organization',
  },
  has_partner: false,
  ...overrides,
});

describe('createCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();

    // Set up mock implementations
    vi.mocked(requireAuthentication).mockReturnValue(true);
    vi.mocked(toHumanReadable).mockImplementation((str: string) =>
      str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    );
    // Default user mock - can be overridden in individual tests
    vi.mocked(getUser).mockResolvedValue({
      user: createMockUser(),
    });
  });

  describe('template validation', () => {
    it('should accept valid template via --template flag', async () => {
      const mockSpace = createMockSpace();

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', './my-project', '--template', 'react']);

      expect(generateProject).toHaveBeenCalledWith('react', 'my-project', expect.any(String));

      // Check if createSpace was called (this is failing with 0 calls)
      expect(createSpace).toHaveBeenCalled();
      expect(createSpace).toHaveBeenCalledWith({
        name: 'My Project',
        domain: templates.REACT.location,
      });
    });

    it('should warn and show interactive selection for invalid template', async () => {
      vi.mocked(select).mockResolvedValue('vue');
      vi.mocked(input).mockResolvedValue('./my-vue-project');

      const mockSpace = createMockSpace();

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', '--template', 'invalid-template']);

      expect(konsola.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid template "invalid-template"'),
      );
      expect(select).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Please select the technology you would like to use:',
      }));
    });

    it('should accept valid template via deprecated --blueprint flag with warning', async () => {
      const mockSpace = createMockSpace();

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', './my-project', '--blueprint', 'react']);

      expect(konsola.warn).toHaveBeenCalledWith('The --blueprint flag is deprecated. Please use --template instead.');
      expect(generateProject).toHaveBeenCalledWith('react', 'my-project', expect.any(String));
    });

    it('should prioritize --template over --blueprint when both are provided', async () => {
      const mockSpace = createMockSpace();

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', './my-project', '--blueprint', 'react', '--template', 'vue']);

      expect(konsola.warn).toHaveBeenCalledWith('Both --blueprint and --template provided. Using --template and ignoring --blueprint.');
      expect(generateProject).toHaveBeenCalledWith('vue', 'my-project', expect.any(String));
    });

    it('should warn about deprecated --blueprint flag and show interactive selection for invalid value', async () => {
      vi.mocked(select).mockResolvedValue('vue');
      vi.mocked(input).mockResolvedValue('./my-vue-project');

      const mockSpace = createMockSpace();

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', '--blueprint', 'invalid-blueprint']);

      expect(konsola.warn).toHaveBeenCalledWith('The --blueprint flag is deprecated. Please use --template instead.');
      expect(konsola.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid template "invalid-blueprint"'),
      );
      expect(select).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Please select the technology you would like to use:',
      }));
    });
  });

  describe('interactive mode', () => {
    it('should prompt for template selection when none provided', async () => {
      vi.mocked(select).mockResolvedValue('react');
      vi.mocked(input).mockResolvedValue('./my-react-project');

      const mockSpace = createMockSpace();

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test']);

      expect(select).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Please select the technology you would like to use:',
        choices: expect.arrayContaining([
          expect.objectContaining({ name: expect.any(String), value: expect.any(String) }),
        ]),
      }));
    });

    it('should prompt for project path when none provided', async () => {
      vi.mocked(select).mockResolvedValue('vue');
      vi.mocked(input).mockResolvedValue('./my-vue-project');

      // Use createMockSpace to ensure the mock matches the Space type
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test']);

      expect(input).toHaveBeenCalledWith(expect.objectContaining({
        message: 'What is the path for your project?',
        default: './my-vue-project',
        validate: expect.any(Function),
      }));
    });

    it('should validate project path input correctly', async () => {
      vi.mocked(select).mockResolvedValue('react');

      const mockValidate = vi.fn();
      (vi.mocked(input) as any).mockImplementation(async (options: any) => {
        mockValidate.mockImplementation(options.validate);
        return './valid-project';
      });

      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test']);

      // Test validation function
      expect(mockValidate('')).toBe('Project path is required');
      expect(mockValidate('   ')).toBe('Project path is required');
      expect(mockValidate('invalid/project/name!')).toBe('Project name (last part of the path) can only contain letters, numbers, hyphens, and underscores');
      expect(mockValidate('./valid-project')).toBe(true);
      expect(mockValidate('./valid_project-123')).toBe(true);
    });
  });

  describe('project generation', () => {
    it('should generate project successfully and create all resources', async () => {
      // Use createMockSpace to ensure the mock matches the Space type
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

      // Verify project generation
      expect(generateProject).toHaveBeenCalledWith('react', 'my-project', expect.any(String));
      expect(konsola.ok).toHaveBeenCalledWith(
        expect.stringContaining('Project my-project created successfully'),
        true,
      );

      // Verify space creation
      expect(createSpace).toHaveBeenCalledWith({
        name: 'My Project',
        domain: templates.REACT.location,
      });

      // Verify .env file creation
      expect(createEnvFile).toHaveBeenCalledWith(expect.any(String), 'space-token-123');
      expect(konsola.ok).toHaveBeenCalledWith('Created .env file with Storyblok access token', true);

      // Verify browser opening
      expect(openSpaceInBrowser).toHaveBeenCalledWith(12345, 'eu');
      expect(konsola.info).toHaveBeenCalledWith('Opened space in your browser');

      // Verify final success messages
      expect(konsola.ok).toHaveBeenCalledWith(
        expect.stringContaining('Your react project is ready 🎉 !'),
      );
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
    });

    it('should handle project generation failure', async () => {
      const generateError = new Error('Failed to generate project');
      vi.mocked(generateProject).mockRejectedValue(generateError);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

      expect(handleError).toHaveBeenCalledWith(generateError, undefined);
    });

    it('should handle space creation failure', async () => {
      const spaceError = new Error('Failed to create space');
      vi.mocked(generateProject).mockResolvedValue(undefined);
      // Use createMockSpace for consistency, even if not used in this test
      vi.mocked(createSpace).mockRejectedValue(spaceError);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

      expect(generateProject).toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(spaceError, undefined);
    });

    it('should handle .env file creation failure gracefully', async () => {
      // Use createMockSpace to ensure the mock matches the Space type
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      const envError = new Error('Permission denied');
      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockRejectedValue(envError);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

      expect(konsola.warn).toHaveBeenCalledWith('Failed to create .env file: Permission denied');
      expect(konsola.info).toHaveBeenCalledWith(
        'You can manually add this token to your .env file: space-token-123',
      );
      // Should continue with browser opening
      expect(openSpaceInBrowser).toHaveBeenCalled();
    });

    it('should handle browser opening failure gracefully', async () => {
      // Use createMockSpace to ensure the mock matches the Space type
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      const browserError = new Error('Failed to open browser');
      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockRejectedValue(browserError);
      vi.mocked(generateSpaceUrl).mockReturnValue('https://app.storyblok.com/#/me/spaces/12345/dashboard');

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

      expect(konsola.warn).toHaveBeenCalledWith('Failed to open browser: Failed to open browser');
      expect(generateSpaceUrl).toHaveBeenCalledWith(12345, 'eu');
      expect(konsola.info).toHaveBeenCalledWith(
        expect.stringContaining('You can manually open your space at:'),
      );
    });
  });

  describe('authentication', () => {
    it('should exit early if user is not authenticated', async () => {
      const { requireAuthentication } = await import('../../utils');
      vi.mocked(requireAuthentication).mockReturnValue(false);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

      expect(generateProject).not.toHaveBeenCalled();
      expect(createSpace).not.toHaveBeenCalled();
    });

    it('should initialize API client with correct credentials', async () => {
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

      expect(mapiClient).toHaveBeenCalledWith({
        token: 'test-token',
        region: 'eu',
      });
    });
  });

  describe('different templates', () => {
    it.each([
      ['react', 'REACT'],
      ['vue', 'VUE'],
      ['svelte', 'SVELTE'],
      ['nuxt', 'NUXT'],
      ['next', 'NEXT'],
    ])('should handle %s template correctly', async (template, templateKey) => {
      // Use createMockSpace to ensure the mock matches the Space type
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Svelte', value: 'svelte', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Nuxt', value: 'nuxt', template: '', location: 'https://localhost:3000/', description: '', updated_at: '' },
        { name: 'Next', value: 'next', template: '', location: 'https://localhost:3000/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', template]);

      expect(generateProject).toHaveBeenCalledWith(template, 'my-project', expect.any(String));
      expect(createSpace).toHaveBeenCalledWith({
        name: 'My Project',
        domain: templates[templateKey as keyof typeof templates].location,
      });
    });
  });

  describe('path handling', () => {
    it('should resolve relative paths correctly', async () => {
      // Use createMockSpace to ensure the mock matches the Space type
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', './projects/my-project', '--template', 'react']);

      expect(generateProject).toHaveBeenCalledWith('react', 'my-project', expect.stringContaining('projects'));
      expect(createEnvFile).toHaveBeenCalledWith(expect.stringContaining('my-project'), 'space-token-123');
    });

    it('should handle absolute paths correctly', async () => {
      // Use createMockSpace to ensure the mock matches the Space type
      const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(createSpace).mockResolvedValue(mockSpace);
      vi.mocked(createEnvFile).mockResolvedValue(undefined);
      vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', '/absolute/path/my-project', '--template', 'react']);

      expect(generateProject).toHaveBeenCalledWith('react', 'my-project', '/absolute/path');
    });
  });

  describe('skip space functionality', () => {
    it('should skip space creation when --skip-space flag is provided', async () => {
      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react', '--skip-space']);

      // Verify project generation still happens
      expect(generateProject).toHaveBeenCalledWith('react', 'my-project', expect.any(String));
      expect(konsola.ok).toHaveBeenCalledWith(
        expect.stringContaining('Project my-project created successfully'),
        true,
      );

      // Verify space creation is skipped
      expect(createSpace).not.toHaveBeenCalled();
      expect(createEnvFile).not.toHaveBeenCalled();
      expect(openSpaceInBrowser).not.toHaveBeenCalled();

      // Verify success message still shows
      expect(konsola.ok).toHaveBeenCalledWith(
        expect.stringContaining('Your react project is ready 🎉 !'),
      );
    });

    it('should skip space creation when --skip-space flag is provided with interactive mode', async () => {
      vi.mocked(select).mockResolvedValue('vue');
      vi.mocked(input).mockResolvedValue('./my-vue-project');
      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', '--skip-space']);

      // Verify interactive prompts still work
      expect(select).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Please select the technology you would like to use:',
      }));
      expect(input).toHaveBeenCalledWith(expect.objectContaining({
        message: 'What is the path for your project?',
      }));

      // Verify project generation happens
      expect(generateProject).toHaveBeenCalled();

      // Verify space-related operations are skipped
      expect(createSpace).not.toHaveBeenCalled();
      expect(createEnvFile).not.toHaveBeenCalled();
      expect(openSpaceInBrowser).not.toHaveBeenCalled();
    });

    it('should still show appropriate messages when skipping space creation', async () => {
      vi.mocked(generateProject).mockResolvedValue(undefined);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react', '--skip-space']);

      // Should show project creation success
      expect(konsola.ok).toHaveBeenCalledWith(
        expect.stringContaining('Project my-project created successfully'),
        true,
      );

      // Should show final success message
      expect(konsola.ok).toHaveBeenCalledWith(
        expect.stringContaining('Your react project is ready 🎉 !'),
      );

      // Should show next steps
      expect(konsola.info).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));

      // Should NOT show space-related success messages
      expect(konsola.ok).not.toHaveBeenCalledWith('Created .env file with Storyblok access token', true);
      expect(konsola.info).not.toHaveBeenCalledWith('Opened space in your browser');
    });

    it('should handle project generation failure even when skipping space creation', async () => {
      const generateError = new Error('Failed to generate project');
      vi.mocked(generateProject).mockRejectedValue(generateError);
      vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
        { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        { name: 'Vue', value: 'vue', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
      ]);

      await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react', '--skip-space']);

      // Should still handle the error properly
      expect(handleError).toHaveBeenCalledWith(generateError, undefined);

      // Should not attempt space operations
      expect(createSpace).not.toHaveBeenCalled();
      expect(createEnvFile).not.toHaveBeenCalled();
      expect(openSpaceInBrowser).not.toHaveBeenCalled();
    });
  });

  describe('space creation choices and location', () => {
    describe('eU region space creation choices', () => {
      it('should automatically create in personal account for users without org or partner', async () => {
        const mockUser = createMockUser({
          has_org: false,
          has_partner: false,
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        // Should not prompt for space creation location since user has no org or partner
        expect(select).not.toHaveBeenCalledWith(expect.objectContaining({
          message: 'Where would you like to create this space?',
        }));

        // Should automatically create space with personal account (no org or partner flags)
        expect(createSpace).toHaveBeenCalledWith({
          name: 'My Project',
          domain: templates.REACT.location,
        });
      });

      it('should show organization choice for users with org in EU region', async () => {
        const mockUser = createMockUser({
          has_org: true,
          has_partner: false,
          org: { name: 'Test Organization' },
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(select)
          .mockResolvedValueOnce('org') // Space creation choice
          .mockResolvedValueOnce('react'); // Blueprint choice if needed
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        // Should prompt for space creation location
        expect(select).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Where would you like to create this space?',
          choices: [
            { name: 'My personal account', value: 'personal' },
            { name: 'Organization (Test Organization)', value: 'org' },
          ],
        }));

        // Should create space with org flags
        expect(createSpace).toHaveBeenCalledWith({
          name: 'My Project',
          domain: templates.REACT.location,
          org: mockUser.org,
          in_org: true,
        });
      });

      it('should show partner portal choice for users with partner in EU region', async () => {
        const mockUser = createMockUser({
          has_org: false,
          has_partner: true,
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(select)
          .mockResolvedValueOnce('partner') // Space creation choice
          .mockResolvedValueOnce('react'); // Blueprint choice if needed
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        // Should prompt for space creation location
        expect(select).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Where would you like to create this space?',
          choices: [
            { name: 'My personal account', value: 'personal' },
            { name: 'Partner Portal', value: 'partner' },
          ],
        }));

        // Should create space with partner flag
        expect(createSpace).toHaveBeenCalledWith({
          name: 'My Project',
          domain: templates.REACT.location,
          assign_partner: true,
        });
      });

      it('should show all choices for users with both org and partner in EU region', async () => {
        const mockUser = createMockUser({
          has_org: true,
          has_partner: true,
          org: { name: 'Test Organization' },
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(select)
          .mockResolvedValueOnce('personal') // Space creation choice
          .mockResolvedValueOnce('react'); // Blueprint choice if needed
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        // Should prompt for space creation location with all options
        expect(select).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Where would you like to create this space?',
          choices: [
            { name: 'My personal account', value: 'personal' },
            { name: 'Organization (Test Organization)', value: 'org' },
            { name: 'Partner Portal', value: 'partner' },
          ],
        }));

        // Should create space with personal account (no special flags)
        expect(createSpace).toHaveBeenCalledWith({
          name: 'My Project',
          domain: templates.REACT.location,
        });
      });
    });

    describe('non-EU region space creation behavior', () => {
      beforeEach(async () => {
        // Mock session to return non-EU region by updating the existing mock
        const sessionModule = await import('../../session');
        const mockSession = sessionModule.session();
        mockSession.state.region = 'us'; // Change to non-EU region
      });

      afterEach(async () => {
        // Reset back to EU region for other tests
        const sessionModule = await import('../../session');
        const mockSession = sessionModule.session();
        mockSession.state.region = 'eu';
      });

      it('should automatically use organization for users with org in non-EU region', async () => {
        const mockUser = createMockUser({
          has_org: true,
          has_partner: false,
          org: { name: 'Test Organization' },
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

        // Should not prompt for space creation location in non-EU with org
        expect(select).not.toHaveBeenCalledWith(expect.objectContaining({
          message: 'Where would you like to create this space?',
        }));

        // Should create space with org flags automatically
        expect(createSpace).toHaveBeenCalledWith({
          name: 'My Project',
          domain: templates.REACT.location,
          org: mockUser.org,
          in_org: true,
        });
      });

      it('should warn and exit for users without org in non-EU region', async () => {
        const mockUser = createMockUser({
          has_org: false,
          has_partner: false,
        });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--template', 'react']);

        // Should show warning message (note: American spelling "organization")
        expect(konsola.warn).toHaveBeenCalledWith(
          'Space creation in this region is limited to Enterprise accounts. If you\'re part of an organization, please ensure you have the required permissions. For more information about Enterprise access, contact our Sales Team.',
        );

        // Should not attempt to create space
        expect(createSpace).not.toHaveBeenCalled();
        expect(createEnvFile).not.toHaveBeenCalled();
        expect(openSpaceInBrowser).not.toHaveBeenCalled();
      });
    });

    describe('success messages based on space creation location', () => {
      it('should show organization-specific success message when creating in org', async () => {
        const mockUser = createMockUser({
          has_org: true,
          has_partner: false,
          org: { name: 'Test Organization' },
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(select).mockResolvedValueOnce('org'); // Space creation choice
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(generateSpaceUrl).mockReturnValue('https://app.storyblok.com/#/me/spaces/12345/dashboard');
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        // Should show organization-specific success message
        expect(konsola.ok).toHaveBeenCalledWith(
          expect.stringContaining('Storyblok space created in organization Test Organization'),
        );
      });

      it('should show partner-specific success message when creating in partner portal', async () => {
        const mockUser = createMockUser({
          has_org: false,
          has_partner: true,
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(select).mockResolvedValueOnce('partner'); // Space creation choice
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(generateSpaceUrl).mockReturnValue('https://app.storyblok.com/#/me/spaces/12345/dashboard');
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        // Should show partner-specific success message
        expect(konsola.ok).toHaveBeenCalledWith(
          expect.stringContaining('Storyblok space created in partner portal'),
        );
      });

      it('should show generic success message when creating in personal account', async () => {
        const mockUser = createMockUser({
          has_org: true,
          has_partner: true,
          org: { name: 'Test Organization' },
        });
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(select).mockResolvedValueOnce('personal'); // Space creation choice
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(generateSpaceUrl).mockReturnValue('https://app.storyblok.com/#/me/spaces/12345/dashboard');
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        // Should show generic success message (not org or partner specific)
        expect(konsola.ok).toHaveBeenCalledWith(
          expect.stringMatching(/^Storyblok space created, preview url and \.env configured automatically/),
        );
        expect(konsola.ok).not.toHaveBeenCalledWith(
          expect.stringContaining('organization'),
        );
        expect(konsola.ok).not.toHaveBeenCalledWith(
          expect.stringContaining('partner portal'),
        );
      });
    });

    describe('user data fetching', () => {
      it('should handle user data fetching failure', async () => {
        const userError = new Error('Failed to fetch user');
        vi.mocked(getUser).mockRejectedValue(userError);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        expect(konsola.error).toHaveBeenCalledWith('Failed to fetch user info. Please login again.', userError);
        expect(generateProject).not.toHaveBeenCalled();
        expect(createSpace).not.toHaveBeenCalled();
      });

      it('should call getUser with correct parameters', async () => {
        const mockUser = createMockUser();
        const mockSpace = createMockSpace({ id: 12345, first_token: 'space-token-123' });

        vi.mocked(getUser).mockResolvedValue({ user: mockUser });
        vi.mocked(generateProject).mockResolvedValue(undefined);
        vi.mocked(createSpace).mockResolvedValue(mockSpace);
        vi.mocked(createEnvFile).mockResolvedValue(undefined);
        vi.mocked(openSpaceInBrowser).mockResolvedValue(undefined);
        vi.mocked(fetchBlueprintRepositories).mockResolvedValue([
          { name: 'React', value: 'react', template: '', location: 'https://localhost:5173/', description: '', updated_at: '' },
        ]);

        await createCommand.parseAsync(['node', 'test', 'my-project', '--blueprint', 'react']);

        expect(getUser).toHaveBeenCalledWith('test-token', 'eu');
      });
    });
  });
});

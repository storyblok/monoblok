import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { generateMigration } from './actions';
// Import the main components module first to ensure proper initialization
import '../index';
import { migrationsCommand } from '../command';
import { fetchComponent } from '../../../commands/components';

vi.mock('node:fs');
vi.mock('node:fs/promises');

vi.mock('../../../commands/components', () => ({
  fetchComponent: vi.fn(),
}));

vi.mock('./actions', () => ({
  generateMigration: vi.fn(),
}));

vi.mock('../../../session', () => ({
  session: vi.fn(() => ({
    state: {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    },
    initializeSession: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.spyOn(console, 'debug');
vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'log');
vi.spyOn(console, 'warn');

const LOG_PREFIX = 'storyblok-migrations-generate-';

const mockComponent = {
  name: 'component-name',
  display_name: 'Component Name',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12345,
  schema: {
    field1: {
      type: 'bloks',
      restrict_type: 'tags',
      component_tag_whitelist: [1, 2],
    },
  },
} as const;

const getLogFileContents = () => {
  return Object.entries(vol.toJSON())
    .find(([filename]) => filename.includes(LOG_PREFIX))?.[1];
};

const preconditions = {
  componentExists() {
    vi.mocked(fetchComponent).mockResolvedValue(mockComponent);
  },
  componentMissing() {
    vi.mocked(fetchComponent).mockResolvedValue(undefined);
  },
};

describe('migrations generate command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
  });

  it('should generate a migration using default path', async () => {
    preconditions.componentExists();

    await migrationsCommand.parseAsync(['node', 'test', 'generate', 'component-name', '--space', '12345']);

    expect(generateMigration).toHaveBeenCalledWith('12345', undefined, expect.objectContaining({ name: 'component-name' }), undefined);
    const logFile = getLogFileContents();
    expect(logFile).toContain('Migration generation finished');
    expect(logFile).toContain('.storyblok/migrations/12345/component-name.js');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('You can find the migration file in .storyblok/migrations/12345/component-name.js'),
    );
  });

  it('should generate a migration using custom path', async () => {
    preconditions.componentExists();

    await migrationsCommand.parseAsync(['node', 'test', 'generate', 'component-name', '--space', '12345', '--path', 'custom']);

    expect(generateMigration).toHaveBeenCalledWith('12345', 'custom', expect.objectContaining({ name: 'component-name' }), undefined);
    const logFile = getLogFileContents();
    expect(logFile).toContain('Migration generation finished');
    expect(logFile).toContain('custom/migrations/12345/component-name.js');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('You can find the migration file in custom/migrations/12345/component-name.js'),
    );
  });

  it('should handle missing component gracefully', async () => {
    preconditions.componentMissing();

    await migrationsCommand.parseAsync(['node', 'test', 'generate', 'component-name', '--space', '12345']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No component found with name "component-name"'),
      '',
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('For more information about the error'),
    );
    const logFile = getLogFileContents();
    expect(logFile).toContain('No component found with name');
  });

  it('should require component name', async () => {
    await migrationsCommand.parseAsync(['node', 'test', 'generate', '--space', '12345']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Please provide the component name as argument'),
      '',
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('For more information about the error'),
    );
    const logFile = getLogFileContents();
    expect(logFile).toContain('Please provide the component name as argument');
  });
});

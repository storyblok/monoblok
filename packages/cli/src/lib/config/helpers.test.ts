import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { resolve as resolvePath } from 'pathe';
import { vol } from 'memfs';
import { CONFIG_FILE_NAME, formatConfigForDisplay, getOptionPath, HIDDEN_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, loadConfigLayers, logActiveConfig } from './helpers';
import type { ResolvedCliConfig } from './types';

const loggerInfoMock = vi.hoisted(() => vi.fn());
const loggerDebugMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const uiInfoMock = vi.hoisted(() => vi.fn());
const supportedExtensions = vi.hoisted(() => ['.json', '.json5', '.jsonc', '.yaml', '.yml', '.toml', '.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']);

vi.mock('node:os', () => ({
  homedir: () => '/home/tester',
}));

vi.mock('node:fs');

vi.mock('./loader', () => ({
  SUPPORTED_EXTENSIONS: supportedExtensions,
  loadConfig: (options: any) => loadConfigMock(options),
}));

vi.mock('../../utils/ui', () => ({
  getUI: () => ({
    info: uiInfoMock,
  }),
}));

vi.mock('../logger/logger', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
    debug: loggerDebugMock,
  }),
}));

const HOME_DIR = '/home/tester';
const WORKSPACE_DIR = '/workspace/project';
const HOME_CONFIG_DIR = resolvePath(HOME_DIR, HIDDEN_CONFIG_DIR);
const LOCAL_CONFIG_DIR = resolvePath(WORKSPACE_DIR, HIDDEN_CONFIG_DIR);

const responses = new Map<string, Record<string, any>>();
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

const preconditions = {
  hasHomeConfig(extension: string, config: Record<string, any>): void {
    const filePath = resolvePath(HOME_CONFIG_DIR, `${HIDDEN_CONFIG_FILE_NAME}${extension}`);
    vol.mkdirSync(HOME_CONFIG_DIR, { recursive: true });
    vol.writeFileSync(filePath, JSON.stringify(config));
    responses.set(HOME_CONFIG_DIR, config);
  },
  hasLocalConfig(extension: string, config: Record<string, any>): void {
    const filePath = resolvePath(LOCAL_CONFIG_DIR, `${HIDDEN_CONFIG_FILE_NAME}${extension}`);
    vol.mkdirSync(LOCAL_CONFIG_DIR, { recursive: true });
    vol.writeFileSync(filePath, JSON.stringify(config));
    responses.set(LOCAL_CONFIG_DIR, config);
  },
  hasWorkspaceConfig(extension: string, config: Record<string, any>): void {
    const filePath = resolvePath(WORKSPACE_DIR, `${CONFIG_FILE_NAME}${extension}`);
    vol.mkdirSync(WORKSPACE_DIR, { recursive: true });
    vol.writeFileSync(filePath, JSON.stringify(config));
    responses.set(WORKSPACE_DIR, config);
  },
  hasNoConfigFiles(): void {
    vol.reset();
    responses.clear();
  },
};

function resetFilesystem(): void {
  vol.reset();
  responses.clear();
}

beforeEach(() => {
  resetFilesystem();
  loadConfigMock.mockImplementation(async ({ cwd }: { cwd: string }) => ({
    config: responses.get(cwd) ?? null,
  }));
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(WORKSPACE_DIR);
});

afterEach(() => {
  cwdSpy?.mockRestore();
  loggerInfoMock.mockReset();
  loggerDebugMock.mockReset();
  loadConfigMock.mockReset();
  uiInfoMock.mockReset();
  vol.reset();
});

describe('loadConfigLayers', () => {
  it('loads configs from home, workspace hidden dir, and project root honoring priority and supported extensions', async () => {
    // Given: config files exist in all three locations
    preconditions.hasHomeConfig('.json', { scope: 'home', ext: 'json' });
    preconditions.hasLocalConfig('.yaml', { scope: 'workspace-hidden', ext: 'yaml' });
    preconditions.hasWorkspaceConfig('.ts', { scope: 'workspace-root', ext: 'ts' });

    // When: loading config layers
    const layers = await loadConfigLayers();

    // Then: all layers are loaded in priority order (home → local → workspace)
    expect(layers).toEqual([
      { scope: 'home', ext: 'json' },
      { scope: 'workspace-hidden', ext: 'yaml' },
      { scope: 'workspace-root', ext: 'ts' },
    ]);
  });

  it('skips locations that do not expose a supported config file', async () => {
    // Given: only workspace config exists
    preconditions.hasWorkspaceConfig('.ts', { scope: 'workspace-root', ext: 'ts' });

    // When: loading config layers
    const layers = await loadConfigLayers();

    // Then: only workspace layer is loaded
    expect(layers).toEqual([{ scope: 'workspace-root', ext: 'ts' }]);
  });

  it('logs fallback info when no config layers are detected', async () => {
    // Given: no config files exist
    preconditions.hasNoConfigFiles();

    // When: loading config layers
    const layers = await loadConfigLayers();

    // Then: empty array is returned and fallback message is logged
    expect(layers).toEqual([]);
    expect(loggerInfoMock).toHaveBeenCalledWith('No config files found, using defaults');
  });
});

function buildCommandChain() {
  const root = new Command('storyblok');
  root
    .exitOverride()
    .option('--verbose', '', false);

  const components = root
    .command('components')
    .option('-s, --space <space>')
    .option('-p, --path <path>');

  const pull = components
    .command('pull')
    .option('--separate-files', '', false)
    .option('--filename <filename>');

  root.setOptionValueWithSource('verbose', true, 'config');
  components.setOptionValueWithSource('space', '123', 'config');
  components.setOptionValueWithSource('path', '.storyblok', 'config');
  pull.setOptionValueWithSource('separateFiles', true, 'config');
  pull.setOptionValueWithSource('filename', 'components', 'config');
  return [root, components, pull];
}

const mockConfig: ResolvedCliConfig = {
  region: 'us',
  api: {
    maxRetries: 5,
    maxConcurrency: 6,
  },
  log: {
    console: {
      enabled: true,
      level: 'info',
    },
    file: {
      enabled: true,
      level: 'warn',
      maxFiles: 10,
    },
  },
  report: {
    enabled: true,
    maxFiles: 5,
  },
  verbose: true,
};

describe('config inspector helpers', () => {
  it('serializes config for display', () => {
    const formatted = formatConfigForDisplay(mockConfig);
    const parsed = JSON.parse(formatted);

    expect(parsed.region).toBe('us');
    expect(parsed.api.maxRetries).toBe(5);
    expect(parsed.log.file.level).toBe('warn');
    expect(parsed.verbose).toBe(true);
  });

  it('logs the active config only when verbose mode is enabled', () => {
    const ancestry = buildCommandChain();

    logActiveConfig(mockConfig, ancestry, false);
    expect(loggerDebugMock).not.toHaveBeenCalled();

    logActiveConfig(mockConfig, ancestry, true);
    expect(loggerDebugMock).toHaveBeenCalledTimes(1);
    expect(loggerDebugMock.mock.calls[0][0]).toBe('Active configuration');
    expect(loggerDebugMock.mock.calls[0][1]).toHaveProperty('command', 'storyblok components pull');
    expect(loggerDebugMock.mock.calls[0][1]).toHaveProperty('config', mockConfig);
  });
});

describe('getOptionPath', () => {
  it('parses hyphenated flags into camelCase path segments', () => {
    const prog = new Command();
    prog.option('--api-max-retries <number>', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    expect(path).toEqual(['api', 'maxRetries']);
  });

  it('handles deeply nested paths with hyphens', () => {
    const prog = new Command();
    prog.option('--log-file-max-files <number>', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    expect(path).toEqual(['log', 'file', 'maxFiles']);
  });

  it('strips --no- prefix from negated boolean flags', () => {
    const prog = new Command();
    prog.option('--no-log-console-enabled', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    expect(path).toEqual(['log', 'console', 'enabled']);
  });

  it('handles single segment flags', () => {
    const prog = new Command();
    prog.option('--verbose', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    expect(path).toEqual(['verbose']);
  });

  it('handles --no- prefix on single segment flags', () => {
    const prog = new Command();
    prog.option('--no-verbose', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    expect(path).toEqual(['verbose']);
  });

  it('dynamically detects path vs property: log is object, console is object, enabled is property', () => {
    const prog = new Command();
    prog.option('--log-console-enabled', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    // log is object, console is object under log, enabled is property
    expect(path).toEqual(['log', 'console', 'enabled']);
  });

  it('dynamically detects path vs property: log is object, file is object, maxFiles is property', () => {
    const prog = new Command();
    prog.option('--log-file-max-files <number>', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    // log is object, file is object under log, max-files becomes maxFiles property
    expect(path).toEqual(['log', 'file', 'maxFiles']);
  });

  it('dynamically detects path vs property: api is object, maxRetries is property', () => {
    const prog = new Command();
    prog.option('--api-max-retries <number>', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    // api is object, max-retries becomes maxRetries property
    expect(path).toEqual(['api', 'maxRetries']);
  });

  it('dynamically detects path vs property: ui is object, enabled is property', () => {
    const prog = new Command();
    prog.option('--ui-enabled', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    // ui is object, enabled is property
    expect(path).toEqual(['ui', 'enabled']);
  });

  it('dynamically detects path vs property: report is object, maxFiles is property', () => {
    const prog = new Command();
    prog.option('--report-max-files <number>', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    // report is object, max-files becomes maxFiles property
    expect(path).toEqual(['report', 'maxFiles']);
  });

  it('handles flags with --no- prefix using dynamic detection', () => {
    const prog = new Command();
    prog.option('--no-log-file-enabled', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    // Strips --no-, then: log is object, file is object, enabled is property
    expect(path).toEqual(['log', 'file', 'enabled']);
  });

  it('treats unknown top-level keys as properties', () => {
    const prog = new Command();
    prog.option('--custom-option <value>', 'desc');

    const option = prog.options[0];
    const path = getOptionPath(option);

    // custom is not in DEFAULT_GLOBAL_CONFIG, so entire thing becomes camelCase property
    expect(path).toEqual(['customOption']);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { resolve as resolvePath } from 'pathe';
import { CONFIG_FILE_NAME, formatConfigForDisplay, getOptionPath, HIDDEN_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, loadConfigLayers, logActiveConfig } from './helpers';
import type { ResolvedCliConfig } from './types';

const existsSyncMock = vi.hoisted(() => vi.fn());
const loggerInfoMock = vi.hoisted(() => vi.fn());
const loggerDebugMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const uiInfoMock = vi.hoisted(() => vi.fn());
const supportedExtensions = vi.hoisted(() => ['.json', '.json5', '.jsonc', '.yaml', '.yml', '.toml', '.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']);

vi.mock('node:os', () => ({
  homedir: () => '/home/tester',
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}));

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

const directories = new Set<string>();
const files = new Set<string>();
const responses = new Map<string, Record<string, any>>();
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

function registerDirectory(path: string): void {
  directories.add(path);
}

function addConfigFile(dir: string, baseFile: string, extension: string): void {
  files.add(resolvePath(dir, `${baseFile}${extension}`));
}

function resetFilesystem(): void {
  directories.clear();
  files.clear();
  responses.clear();
  registerDirectory(HOME_CONFIG_DIR);
  registerDirectory(LOCAL_CONFIG_DIR);
  registerDirectory(WORKSPACE_DIR);
}

beforeEach(() => {
  resetFilesystem();
  existsSyncMock.mockImplementation((target: string) => directories.has(target) || files.has(target));
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
  existsSyncMock.mockReset();
  uiInfoMock.mockReset();
});

describe('loadConfigLayers', () => {
  it('loads configs from home, workspace hidden dir, and project root honoring priority and supported extensions', async () => {
    addConfigFile(HOME_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, '.json');
    addConfigFile(LOCAL_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, '.yaml');
    addConfigFile(WORKSPACE_DIR, CONFIG_FILE_NAME, '.ts');

    responses.set(HOME_CONFIG_DIR, { scope: 'home', ext: 'json' });
    responses.set(LOCAL_CONFIG_DIR, { scope: 'workspace-hidden', ext: 'yaml' });
    responses.set(WORKSPACE_DIR, { scope: 'workspace-root', ext: 'ts' });

    const layers = await loadConfigLayers();

    expect(layers).toEqual([
      { scope: 'home', ext: 'json' },
      { scope: 'workspace-hidden', ext: 'yaml' },
      { scope: 'workspace-root', ext: 'ts' },
    ]);

    expect(loadConfigMock).toHaveBeenCalledTimes(3);
    expect(loadConfigMock.mock.calls.map(([options]: any) => `${options.cwd}:${options.configFile}`)).toEqual([
      `${HOME_CONFIG_DIR}:${HIDDEN_CONFIG_FILE_NAME}`,
      `${LOCAL_CONFIG_DIR}:${HIDDEN_CONFIG_FILE_NAME}`,
      `${WORKSPACE_DIR}:${CONFIG_FILE_NAME}`,
    ]);
    expect(uiInfoMock).toHaveBeenCalledTimes(3);
    expect(uiInfoMock.mock.calls.map(([message]: [string]) => message)).toEqual([
      `Loaded Storyblok config: ${resolvePath(HOME_CONFIG_DIR, `${HIDDEN_CONFIG_FILE_NAME}.json`)}`,
      `Loaded Storyblok config: ${resolvePath(LOCAL_CONFIG_DIR, `${HIDDEN_CONFIG_FILE_NAME}.yaml`)}`,
      `Loaded Storyblok config: ${resolvePath(WORKSPACE_DIR, `${CONFIG_FILE_NAME}.ts`)}`,
    ]);

    const expectedCandidates = [
      resolvePath(HOME_CONFIG_DIR, `${HIDDEN_CONFIG_FILE_NAME}.json`),
      resolvePath(LOCAL_CONFIG_DIR, `${HIDDEN_CONFIG_FILE_NAME}.json`),
      resolvePath(LOCAL_CONFIG_DIR, `${HIDDEN_CONFIG_FILE_NAME}.yaml`),
      resolvePath(WORKSPACE_DIR, `${CONFIG_FILE_NAME}.json`),
      resolvePath(WORKSPACE_DIR, `${CONFIG_FILE_NAME}.yaml`),
      resolvePath(WORKSPACE_DIR, `${CONFIG_FILE_NAME}.ts`),
    ];
    for (const candidate of expectedCandidates) {
      expect(existsSyncMock).toHaveBeenCalledWith(candidate);
    }
  });

  it('skips locations that do not expose a supported config file', async () => {
    addConfigFile(WORKSPACE_DIR, CONFIG_FILE_NAME, '.ts');
    responses.set(WORKSPACE_DIR, { scope: 'workspace-root', ext: 'ts' });

    const layers = await loadConfigLayers();

    expect(layers).toEqual([{ scope: 'workspace-root', ext: 'ts' }]);
    expect(loadConfigMock).toHaveBeenCalledTimes(1);
    expect(loadConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      cwd: WORKSPACE_DIR,
      configFile: CONFIG_FILE_NAME,
    }));
    expect(uiInfoMock).toHaveBeenCalledTimes(1);
    expect(uiInfoMock).toHaveBeenCalledWith(
      `Loaded Storyblok config: ${resolvePath(WORKSPACE_DIR, `${CONFIG_FILE_NAME}.ts`)}`,
      expect.any(Object),
    );
  });

  it('logs fallback info when no config layers are detected', async () => {
    const layers = await loadConfigLayers();

    expect(layers).toEqual([]);
    expect(uiInfoMock).toHaveBeenCalledWith('No Storyblok config files found. Falling back to defaults.');
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
    expect(uiInfoMock).not.toHaveBeenCalled();

    logActiveConfig(mockConfig, ancestry, true);
    expect(uiInfoMock).toHaveBeenCalledTimes(1);
    expect(uiInfoMock.mock.calls[0][0]).toContain('Active config for "storyblok components pull"');
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

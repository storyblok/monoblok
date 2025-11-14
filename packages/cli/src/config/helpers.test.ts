import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { resolve as resolvePath } from 'pathe';
import { CONFIG_FILE_NAME, formatConfigForDisplay, HIDDEN_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, loadConfigLayers, logActiveConfig } from './helpers';
import type { ResolvedCliConfig } from './types';
import { parseOptionalBoolean } from './options';

const existsSyncMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const konsolaInfoMock = vi.hoisted(() => vi.fn());
const supportedExtensions = vi.hoisted(() => ['.json', '.yaml', '.ts']);

vi.mock('node:os', () => ({
  homedir: () => '/home/tester',
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}));

vi.mock('c12', () => ({
  SUPPORTED_EXTENSIONS: supportedExtensions,
  loadConfig: (options: any) => loadConfigMock(options),
}));

vi.mock('../utils/konsola', () => ({
  konsola: {
    info: konsolaInfoMock,
  },
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
  loadConfigMock.mockReset();
  existsSyncMock.mockReset();
  konsolaInfoMock.mockReset();
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
    expect(konsolaInfoMock).toHaveBeenCalledTimes(3);
    expect(konsolaInfoMock.mock.calls.map(([message]: [string]) => message)).toEqual([
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
    expect(konsolaInfoMock).toHaveBeenCalledTimes(1);
    expect(konsolaInfoMock).toHaveBeenCalledWith(
      `Loaded Storyblok config: ${resolvePath(WORKSPACE_DIR, `${CONFIG_FILE_NAME}.ts`)}`,
      expect.any(Object),
    );
  });

  it('logs fallback info when no config layers are detected', async () => {
    const layers = await loadConfigLayers();

    expect(layers).toEqual([]);
    expect(konsolaInfoMock).toHaveBeenCalledWith('No Storyblok config files found. Falling back to defaults.');
  });
});

function buildCommandChain() {
  const root = new Command('storyblok');
  root
    .exitOverride()
    .option('--verbose [boolean]', '', parseOptionalBoolean, false);

  const components = root
    .command('components')
    .option('-s, --space <space>')
    .option('-p, --path <path>');

  const pull = components
    .command('pull')
    .option('--separate-files [boolean]', '', parseOptionalBoolean, false)
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
  it('serializes global and local config for display', () => {
    const ancestry = buildCommandChain();
    const formatted = formatConfigForDisplay(mockConfig, ancestry);
    const parsed = JSON.parse(formatted);

    expect(parsed.global.region).toBe('us');
    expect(parsed.global.api.maxRetries).toBe(5);
    expect(parsed.global.log.file.level).toBe('warn');
    expect(parsed.local.components.space).toBe('123');
    expect(parsed.local.components.path).toBe('.storyblok');
    expect(parsed.local.pull.filename).toBe('components');
  });

  it('logs the active config only when verbose mode is enabled', () => {
    const ancestry = buildCommandChain();

    logActiveConfig(mockConfig, ancestry, false);
    expect(konsolaInfoMock).not.toHaveBeenCalled();

    logActiveConfig(mockConfig, ancestry, true);
    expect(konsolaInfoMock).toHaveBeenCalledTimes(1);
    expect(konsolaInfoMock.mock.calls[0][0]).toContain('Active config for "storyblok components pull"');
  });
});

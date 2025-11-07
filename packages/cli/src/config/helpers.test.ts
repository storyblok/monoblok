import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve as resolvePath } from 'pathe';
import { CONFIG_FILE_NAME, HIDDEN_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, loadConfigLayers } from './helpers';

const existsSyncMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const supportedExtensions = vi.hoisted(() => ['json', 'yaml', 'ts']);

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
  files.add(resolvePath(dir, `${baseFile}.${extension}`));
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
});

describe('loadConfigLayers', () => {
  it('loads configs from home, workspace hidden dir, and project root honoring priority and supported extensions', async () => {
    addConfigFile(HOME_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, 'json');
    addConfigFile(LOCAL_CONFIG_DIR, HIDDEN_CONFIG_FILE_NAME, 'yaml');
    addConfigFile(WORKSPACE_DIR, CONFIG_FILE_NAME, 'ts');

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
    addConfigFile(WORKSPACE_DIR, CONFIG_FILE_NAME, 'ts');
    responses.set(WORKSPACE_DIR, { scope: 'workspace-root', ext: 'ts' });

    const layers = await loadConfigLayers();

    expect(layers).toEqual([{ scope: 'workspace-root', ext: 'ts' }]);
    expect(loadConfigMock).toHaveBeenCalledTimes(1);
    expect(loadConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      cwd: WORKSPACE_DIR,
      configFile: CONFIG_FILE_NAME,
    }));
  });
});

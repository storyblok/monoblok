import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { resolveConfig } from './resolver';
import { applyConfigToCommander } from './commander';
import { createDefaultResolvedConfig } from './defaults';
import { defineConfig } from './types';
import * as helpers from './helpers';
import { GLOBAL_OPTION_DEFINITIONS } from './options';

vi.mock('./loader', () => ({
  loadConfig: vi.fn(),
  SUPPORTED_EXTENSIONS: ['.json', '.json5', '.jsonc', '.yaml', '.yml', '.toml', '.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'],
}));

interface CommandHierarchy {
  root: Command;
  components: Command;
  pull: Command;
  push: Command;
}

function registerGlobalOptions(command: Command): void {
  for (const option of GLOBAL_OPTION_DEFINITIONS) {
    if (option.parser) {
      command.option(option.flags, option.description, option.parser as (value: string, previous: unknown) => unknown, option.defaultValue as string | boolean | number);
    }
    else {
      command.option(option.flags, option.description, option.defaultValue as string | boolean | string[]);
    }
  }
}

function createCommandHierarchy(): CommandHierarchy {
  const root = new Command('storyblok');
  root
    .exitOverride();
  registerGlobalOptions(root);

  const components = root
    .command('components');

  const pull = components
    .command('pull')
    .option('--separate-files', 'Separate output per component', false)
    .option('--filename <filename>', 'Filename used for exports', 'components')
    .option('--suffix <suffix>', 'Optional filename suffix')
    .option('-s, --space <space>', 'space ID')
    .option('-p, --path <path>', 'path for file storage');

  const push = components
    .command('push')
    .option('--dry-run', 'Preview component push', false)
    .option('-s, --space <space>', 'space ID')
    .option('-p, --path <path>', 'path for file storage');

  return { root, components, pull, push };
}

describe('config resolver', () => {
  let loadConfigLayersSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loadConfigLayersSpy = vi.spyOn(helpers, 'loadConfigLayers').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses default values when no config layers are present', async () => {
    const { root, components, pull } = createCommandHierarchy();
    const resolved = await resolveConfig(pull, [root, components, pull]);

    const defaultConfig = createDefaultResolvedConfig();
    expect(resolved.region).toBe(defaultConfig.region);
    expect(resolved.api.maxRetries).toBe(defaultConfig.api.maxRetries);
    expect(resolved.log.console.level).toBe(defaultConfig.log.console.level);
    expect(resolved.filename).toBe('components');
    expect(resolved.separateFiles).toBe(false);
    expect(resolved.path).toBeUndefined();
  });

  it('flattens module-level config down to the current command', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        modules: {
          components: {
            path: '.storyblok',
            pull: {
              separateFiles: true,
              suffix: 'custom',
            },
          },
        },
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.path).toBe('.storyblok');
    expect(resolved.separateFiles).toBe(true);
    expect(resolved.suffix).toBe('custom');
    expect(resolved).not.toHaveProperty('pull');
  });

  it('shares first-level module config across every sub-command', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        modules: {
          components: {
            path: '.storyblok',
            push: {
              dryRun: true,
            },
          },
        },
      },
    ]);

    const { root, components, push } = createCommandHierarchy();
    const resolved = await resolveConfig(push, [root, components, push]);

    expect(resolved.path).toBe('.storyblok');
    expect(resolved.dryRun).toBe(true);
  });

  it('prefers specific config layers but leaves CLI overrides as the final word', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        api: { maxRetries: 1 },
        modules: {
          components: {
            path: 'layer-one',
            pull: { separateFiles: false },
          },
        },
      },
      {
        api: { maxRetries: 9 },
        modules: {
          components: {
            path: 'layer-two',
            pull: { separateFiles: false },
          },
        },
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    root.setOptionValueWithSource('region', 'cn', 'cli');
    pull.setOptionValueWithSource('path', './from-cli', 'cli');
    pull.setOptionValueWithSource('separateFiles', true, 'cli');

    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.api.maxRetries).toBe(9);
    expect(resolved.region).toBe('cn');
    expect(resolved.path).toBe('./from-cli');
    expect(resolved.separateFiles).toBe(true);
  });

  it('allows config layers to toggle verbose while keeping CLI overrides authoritative', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        verbose: true,
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const ancestry = [root, components, pull];
    const resolved = await resolveConfig(pull, ancestry);

    expect(resolved.verbose).toBe(true);
    applyConfigToCommander(ancestry, resolved);
    expect(root.getOptionValue('verbose')).toBe(true);

    root.setOptionValueWithSource('verbose', false, 'cli');
    const resolvedWithCli = await resolveConfig(pull, ancestry);
    expect(resolvedWithCli.verbose).toBe(false);
  });

  it('hydrates commander options with resolved config values', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        region: 'us',
        modules: {
          components: {
            path: '.storyblok',
            pull: {
              suffix: 'resolved',
            },
          },
        },
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const ancestry = [root, components, pull];
    const resolved = await resolveConfig(pull, ancestry);

    const defaultConfig = createDefaultResolvedConfig();
    expect(root.getOptionValue('region')).toBe(defaultConfig.region);
    expect(pull.getOptionValue('path')).toBeUndefined();
    expect(pull.getOptionValue('suffix')).toBeUndefined();

    applyConfigToCommander(ancestry, resolved);

    expect(root.getOptionValue('region')).toBe('us');
    expect(pull.getOptionValue('path')).toBe('.storyblok');
    expect(pull.getOptionValue('suffix')).toBe('resolved');
  });

  it('coerces numeric space to string in resolved config', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        space: 12345,
        modules: {
          components: {},
        },
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.space).toBe('12345');
    expect(typeof resolved.space).toBe('string');
  });

  it('preserves string space as-is', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        space: '67890',
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.space).toBe('67890');
  });

  it('resolves global space when no module override exists', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        space: 111,
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.space).toBe('111');
  });

  it('module-level space overrides global space', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        space: 111,
        modules: {
          components: {
            space: 222,
          },
        },
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.space).toBe('222');
  });

  it('subcommand-level space overrides module-level space', async () => {
    loadConfigLayersSpy.mockResolvedValue([
      {
        space: 111,
        modules: {
          components: {
            space: 222,
            pull: {
              space: 333,
            },
          },
        },
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.space).toBe('333');
  });

  it('warns on unknown module key', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    loadConfigLayersSpy.mockResolvedValue([
      {
        modules: {
          components: { path: '.storyblok' },
          unknownModule: { foo: 'bar' },
        },
      },
    ]);

    const { root, components, pull } = createCommandHierarchy();
    await resolveConfig(pull, [root, components, pull]);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown module "unknownModule"'),
    );

    warnSpy.mockRestore();
  });
});

describe('defineConfig', () => {
  it('returns the same config reference for typed authoring', () => {
    const input = {
      region: 'us',
      modules: {
        components: {
          path: '.storyblok',
          pull: {
            separateFiles: true,
          },
        },
      },
    } as const;
    const result = defineConfig(input);
    expect(result).toBe(input);
  });
});

describe('global option definitions', () => {
  function buildProgram(): Command {
    const program = new Command('storyblok');
    program.exitOverride();
    registerGlobalOptions(program);
    return program;
  }

  it('treats bare verbose flag as true', () => {
    const program = buildProgram();
    program.parse(['node', 'cli', '--verbose']);
    expect(program.opts().verbose).toBe(true);
  });

  it('does not support --no-verbose since verbose defaults to false', () => {
    const program = buildProgram();
    // verbose defaults to false, so only --verbose is available to enable it
    program.parse(['node', 'cli']);
    expect(program.opts().verbose).toBe(false);

    const program2 = buildProgram();
    program2.parse(['node', 'cli', '--verbose']);
    expect(program2.opts().verbose).toBe(true);
  });

  it('supports both positive and negative forms for log-console-enabled', () => {
    const program = buildProgram();
    // Default is false
    program.parse(['node', 'cli']);
    expect(program.opts().logConsoleEnabled).toBe(false);

    const program2 = buildProgram();
    program2.parse(['node', 'cli', '--no-log-console-enabled']);
    expect(program2.opts().logConsoleEnabled).toBe(false);

    const program3 = buildProgram();
    program3.parse(['node', 'cli', '--log-console-enabled']);
    expect(program3.opts().logConsoleEnabled).toBe(true);
  });

  it('supports both positive and negative forms for ui-enabled', () => {
    const program = buildProgram();
    program.parse(['node', 'cli', '--no-ui-enabled']);
    expect(program.opts().uiEnabled).toBe(false);

    const program2 = buildProgram();
    program2.parse(['node', 'cli', '--ui-enabled']);
    expect(program2.opts().uiEnabled).toBe(true);

    const program3 = buildProgram();
    // Defaults to true when neither flag is provided
    program3.parse(['node', 'cli']);
    expect(program3.opts().uiEnabled).toBe(true);
  });

  it('supports both positive and negative forms for log-file-enabled', () => {
    const program = buildProgram();
    program.parse(['node', 'cli', '--no-log-file-enabled']);
    expect(program.opts().logFileEnabled).toBe(false);

    const program2 = buildProgram();
    program2.parse(['node', 'cli', '--log-file-enabled']);
    expect(program2.opts().logFileEnabled).toBe(true);
  });

  it('supports both positive and negative forms for report-enabled', () => {
    const program = buildProgram();
    program.parse(['node', 'cli', '--no-report-enabled']);
    expect(program.opts().reportEnabled).toBe(false);

    const program2 = buildProgram();
    program2.parse(['node', 'cli', '--report-enabled']);
    expect(program2.opts().reportEnabled).toBe(true);

    const program3 = buildProgram();
    // Defaults to true when neither flag is provided
    program3.parse(['node', 'cli']);
    expect(program3.opts().reportEnabled).toBe(true);
  });

  it('allows overriding config file boolean values with both positive and negative flags', () => {
    const program = buildProgram();
    // User can explicitly enable a feature that might be disabled in config
    program.parse(['node', 'cli', '--log-file-enabled']);
    expect(program.opts().logFileEnabled).toBe(true);

    const program2 = buildProgram();
    // User can explicitly disable a feature that might be enabled in config
    program2.parse(['node', 'cli', '--no-log-file-enabled']);
    expect(program2.opts().logFileEnabled).toBe(false);
  });
});

describe('deeply nested command structures', () => {
  it('supports arbitrary command depth in module config', async () => {
    const loadConfigLayersSpy = vi.spyOn(helpers, 'loadConfigLayers').mockResolvedValue([
      {
        modules: {
          components: {
            pull: {
              show: {
                deepOption: 'deep-value',
                nestedFlag: true,
              },
            },
          },
        },
      },
    ]);

    const root = new Command('storyblok');
    root.exitOverride();
    registerGlobalOptions(root);

    const components = root
      .command('components');

    const pull = components
      .command('pull')
      .option('--filename <filename>', 'Filename', 'components')
      .option('-s, --space <space>', 'space ID')
      .option('-p, --path <path>', 'path for file storage');

    const show = pull
      .command('show')
      .option('--deep-option <value>', 'Deep option')
      .option('--nested-flag', 'Nested flag', false);

    const resolved = await resolveConfig(show, [root, components, pull, show]);

    expect(resolved.deepOption).toBe('deep-value');
    expect(resolved.nestedFlag).toBe(true);
    expect(resolved.filename).toBe('components');

    loadConfigLayersSpy.mockRestore();
  });

  it('extracts direct values at each nesting level correctly', async () => {
    const loadConfigLayersSpy = vi.spyOn(helpers, 'loadConfigLayers').mockResolvedValue([
      {
        modules: {
          components: {
            sharedOption: 'shared-at-components',
            pull: {
              pullOption: 'pull-level',
              show: {
                showOption: 'show-level',
              },
            },
          },
        },
      },
    ]);

    const root = new Command('storyblok');
    root.exitOverride();
    registerGlobalOptions(root);

    const components = root
      .command('components')
      .option('--shared-option <value>', 'Shared option');

    const pull = components
      .command('pull')
      .option('--pull-option <value>', 'Pull option');

    const show = pull
      .command('show')
      .option('--show-option <value>', 'Show option');

    const resolved = await resolveConfig(show, [root, components, pull, show]);

    // All options from the hierarchy should be present
    expect(resolved.sharedOption).toBe('shared-at-components');
    expect(resolved.pullOption).toBe('pull-level');
    expect(resolved.showOption).toBe('show-level');

    loadConfigLayersSpy.mockRestore();
  });
});

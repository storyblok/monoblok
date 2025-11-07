import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { resolveConfig } from './resolver';
import { applyConfigToCommander } from './commander';
import { DEFAULT_GLOBAL_CONFIG } from './defaults';
import { defineConfig } from './types';
import * as helpers from './helpers';

interface CommandHierarchy {
  root: Command;
  components: Command;
  pull: Command;
  push: Command;
}

function createCommandHierarchy(): CommandHierarchy {
  const root = new Command('storyblok');
  root
    .exitOverride()
    .option('--region <region>', 'Storyblok region', DEFAULT_GLOBAL_CONFIG.region);

  const components = root
    .command('components')
    .option('--path <path>', 'Components working directory');

  const pull = components
    .command('pull')
    .option('--separate-files', 'Separate output per component', false)
    .option('--filename <filename>', 'Filename used for exports', 'components')
    .option('--suffix <suffix>', 'Optional filename suffix');

  const push = components
    .command('push')
    .option('--dry-run', 'Preview component push', false);

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

    expect(resolved.region).toBe(DEFAULT_GLOBAL_CONFIG.region);
    expect(resolved.api.maxRetries).toBe(DEFAULT_GLOBAL_CONFIG.api.maxRetries);
    expect(resolved.log.console.level).toBe(DEFAULT_GLOBAL_CONFIG.log.console.level);
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
    components.setOptionValueWithSource('path', './from-cli', 'cli');
    pull.setOptionValueWithSource('separateFiles', true, 'cli');

    const resolved = await resolveConfig(pull, [root, components, pull]);

    expect(resolved.api.maxRetries).toBe(9);
    expect(resolved.region).toBe('cn');
    expect(resolved.path).toBe('./from-cli');
    expect(resolved.separateFiles).toBe(true);
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

    expect(root.getOptionValue('region')).toBe(DEFAULT_GLOBAL_CONFIG.region);
    expect(components.getOptionValue('path')).toBeUndefined();
    expect(pull.getOptionValue('suffix')).toBeUndefined();

    applyConfigToCommander(ancestry, resolved);

    expect(root.getOptionValue('region')).toBe('us');
    expect(components.getOptionValue('path')).toBe('.storyblok');
    expect(pull.getOptionValue('suffix')).toBe('resolved');
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

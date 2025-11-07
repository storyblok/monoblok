import { resolve as resolvePath } from 'pathe';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { loadConfig, SUPPORTED_EXTENSIONS } from 'c12';
import { toCamelCase } from '../utils/format';
import { isPlainObject } from '../utils/object';
import { konsola } from '../utils/konsola';
import type {
  CommanderCommand,
  CommanderOption,
  ConfigLocation,
  PlainObject,
  ResolvedCliConfig,
} from './types';

export const CONFIG_FILE_NAME = 'storyblok.config';
export const HIDDEN_CONFIG_DIR = '.storyblok';
export const HIDDEN_CONFIG_FILE_NAME = 'config';

// Writes a value into a nested object by following the option path (creating objects along the way).
export function setValueAtPath(target: PlainObject, path: string[], value: unknown): void {
  if (!path.length) {
    return;
  }
  let current: PlainObject = target;
  path.forEach((key, index) => {
    if (index === path.length - 1) {
      current[key] = value;
      return;
    }
    if (!isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  });
}

// Reads a nested value described by the option path. Returns undefined when any segment is missing.
export function getValueAtPath(source: Record<string, any>, path: string[]): unknown {
  return path.reduce<unknown>((accumulator, key) => {
    if (accumulator === null || typeof accumulator !== 'object') {
      return undefined;
    }
    return (accumulator as Record<string, any>)[key];
  }, source);
}

// Pick only the direct scalar fields at a module level (nested objects belong to child commands).
export function extractDirectValues(input: PlainObject): PlainObject {
  const direct: PlainObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (isPlainObject(value)) {
      continue;
    }
    direct[key] = value;
  }
  return direct;
}

// Builds the chain of commands from root to the current command (used for scoping defaults/overrides).
export function getCommandAncestry(command: CommanderCommand): CommanderCommand[] {
  const chain: CommanderCommand[] = [];
  let current: CommanderCommand | null = command;
  while (current) {
    chain.unshift(current);
    current = current.parent;
  }
  return chain;
}

export function getOptionPath(option: CommanderOption): string[] {
  const longFlag = option.long || option.flags.split(',').pop()?.trim();
  if (!longFlag) {
    return [option.attributeName()];
  }
  const normalized = longFlag.replace(/^--/, '');
  return normalized
    .split('.')
    // Commander flags use kebab/dot case; convert segments to the camelCase keys in config.
    .map(segment => toCamelCase(segment));
}

function resolveConfigFilePath(cwd: string, configFile: string): string | null {
  for (const ext of SUPPORTED_EXTENSIONS) {
    const candidate = resolvePath(cwd, `${configFile}${ext}`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function loadConfigLayer({ cwd, configFile }: ConfigLocation): Promise<Record<string, any> | null> {
  if (!existsSync(cwd)) {
    return null;
  }
  const filePath = resolveConfigFilePath(cwd, configFile);
  if (!filePath) {
    return null;
  }
  konsola.info(`Loaded Storyblok config: ${filePath}`, { margin: false });
  const { config } = await loadConfig({
    name: 'storyblok',
    cwd,
    configFile,
    rcFile: false,
    globalRc: false,
    dotenv: false,
    packageJson: false,
  });
  return config ?? null;
}

export async function loadConfigLayers(): Promise<Record<string, any>[]> {
  const cwd = process.cwd();

  // Order: most general (home) first so workspace configs override during merging.
  const locations: ConfigLocation[] = [
    {
      cwd: resolvePath(homedir(), HIDDEN_CONFIG_DIR),
      configFile: HIDDEN_CONFIG_FILE_NAME,
    },
    {
      cwd: resolvePath(cwd, HIDDEN_CONFIG_DIR),
      configFile: HIDDEN_CONFIG_FILE_NAME,
    },
    {
      cwd,
      configFile: CONFIG_FILE_NAME,
    },
  ];

  const layers: Record<string, any>[] = [];
  for (const location of locations) {
    const layer = await loadConfigLayer(location);
    if (layer) {
      layers.push(layer);
    }
  }
  if (!layers.length) {
    konsola.info('No Storyblok config files found. Falling back to defaults.');
  }
  return layers;
}

function pickLocalOptions(command: CommanderCommand): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const option of command.options) {
    const attrName = option.attributeName();
    snapshot[attrName] = command.getOptionValue(attrName);
  }
  return snapshot;
}

export function formatConfigForDisplay(config: ResolvedCliConfig, ancestry: CommanderCommand[]): string {
  const [, ...commands] = ancestry;
  const localBag: Record<string, unknown> = {};
  for (const command of commands) {
    localBag[command.name()] = pickLocalOptions(command);
  }
  const payload = {
    global: {
      region: config.region,
      api: config.api,
      log: config.log,
      report: config.report,
      verbose: config.verbose,
    },
    local: localBag,
  };
  return JSON.stringify(payload, null, 2);
}

export function logActiveConfig(config: ResolvedCliConfig, ancestry: CommanderCommand[], verbose: boolean): void {
  if (!verbose) {
    return;
  }
  const layerName = ancestry.map(cmd => cmd.name()).join(' ');
  const formattedConfig = formatConfigForDisplay(config, ancestry);
  konsola.info(`Active config for "${layerName}":\n${formattedConfig}`, { margin: false });
}

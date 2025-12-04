import { resolve as resolvePath } from 'pathe';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { isPlainObject } from '../../utils/object';
import { getLogger } from '../logger/logger';
import { createDefaultResolvedConfig } from './defaults';
import { loadConfig, SUPPORTED_EXTENSIONS } from './loader';
import type {
  ApiConfig,
  CommanderCommand,
  CommanderOption,
  ConfigLocation,
  GlobalConfig,
  LogConfig,
  LogConsoleConfig,
  LogFileConfig,
  PlainObject,
  ReportConfig,
  ResolvedCliConfig,
} from './types';

// Type representing any level of the config hierarchy during path traversal
type ConfigLevel = GlobalConfig | ApiConfig | LogConfig | LogConsoleConfig | LogFileConfig | ReportConfig | Record<string, unknown>;

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

  // Remove the -- prefix and check for --no-* negation prefix
  let normalized = longFlag.replace(/^--/, '');
  const isNegated = normalized.startsWith('no-');

  // Remove the no- prefix if present (Commander uses --no-* for boolean negation)
  if (isNegated) {
    normalized = normalized.replace(/^no-/, '');
  }

  // Split on hyphens to get all segments
  const segments = normalized.split('-');
  const path: string[] = [];

  // Dynamically determine path vs property by checking if partial path is an object in DEFAULT_GLOBAL_CONFIG
  // For example, for --log-file-max-files:
  // - Check if 'log' is an object → yes, add to path
  // - Check if 'log.file' is an object → yes, add to path
  // - Check if 'log.file.max' is an object → no, so 'max-files' becomes property 'maxFiles'
  let currentConfig: ConfigLevel = createDefaultResolvedConfig();
  let i = 0;

  while (i < segments.length) {
    const segment = segments[i];

    // Check if this segment exists as an object in the current config level
    const currentAsRecord = currentConfig as Record<string, unknown>;
    if (currentConfig && isPlainObject(currentAsRecord[segment])) {
      path.push(segment);
      currentConfig = currentAsRecord[segment] as ConfigLevel;
      i++;
    }
    else {
      // Remaining segments form the property name - convert to camelCase
      const remainingSegments = segments.slice(i);
      const camelCased = remainingSegments
        .map((seg, idx) => idx === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1))
        .join('');
      path.push(camelCased);
      break;
    }
  }

  return path;
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

  const logger = getLogger();
  logger.info('Config file loaded', { filePath, cwd, configFile });

  const { config } = await loadConfig({
    name: 'storyblok',
    cwd,
    configFile,
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
    const logger = getLogger();
    logger.info('No config files found, using defaults');
  }
  return layers;
}

export function formatConfigForDisplay(config: ResolvedCliConfig): string {
  return JSON.stringify(config, null, 2);
}

export function logActiveConfig(config: ResolvedCliConfig, ancestry: CommanderCommand[], verbose: boolean): void {
  if (!verbose) {
    return;
  }
  const layerName = ancestry.map(cmd => cmd.name()).join(' ');

  // Use logger for structured logging
  const logger = getLogger();
  logger.debug('Active configuration', { command: layerName, config });
}

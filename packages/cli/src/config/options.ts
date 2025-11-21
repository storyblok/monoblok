import { DEFAULT_GLOBAL_CONFIG } from './defaults';
import type { GlobalOptionDefinition } from './types';

export function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean value "${value}". Use true/false.`);
}

export function parseNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`Invalid number value "${value}".`);
  }
  return parsed;
}

export function parseOptionalBoolean(value?: string): boolean {
  if (value === undefined) {
    return true;
  }
  return parseBoolean(value);
}

export const GLOBAL_OPTION_DEFINITIONS: GlobalOptionDefinition[] = [
  {
    flags: '--verbose [boolean]',
    description: 'Enable verbose output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.verbose,
    parser: parseOptionalBoolean,
  },
  {
    flags: '--region <region>',
    description: 'Storyblok region used for API requests',
    defaultValue: DEFAULT_GLOBAL_CONFIG.region,
  },
  {
    flags: '--api.max-retries <number>',
    description: 'Maximum retry attempts for HTTP requests',
    defaultValue: DEFAULT_GLOBAL_CONFIG.api.maxRetries,
    parser: parseNumber,
  },
  {
    flags: '--api.max-concurrency <number>',
    description: 'Maximum concurrent API requests executed by the CLI',
    defaultValue: DEFAULT_GLOBAL_CONFIG.api.maxConcurrency,
    parser: parseNumber,
  },
  {
    flags: '--log.console.enabled [boolean]',
    description: 'Enable console logging output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.console.enabled,
    parser: parseOptionalBoolean,
  },
  {
    flags: '--log.console.level <level>',
    description: 'Console log level threshold',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.console.level,
  },
  {
    flags: '--log.file.enabled [boolean]',
    description: 'Enable file logging output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.file.enabled,
    parser: parseOptionalBoolean,
  },
  {
    flags: '--log.file.level <level>',
    description: 'File log level threshold',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.file.level,
  },
  {
    flags: '--log.file.max-files <number>',
    description: 'Maximum amount of log files to keep on disk',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.file.maxFiles,
    parser: parseNumber,
  },
  {
    flags: '--report.enabled [boolean]',
    description: 'Enable report generation after command execution',
    defaultValue: DEFAULT_GLOBAL_CONFIG.report.enabled,
    parser: parseOptionalBoolean,
  },
  {
    flags: '--report.max-files <number>',
    description: 'Maximum number of report files to keep',
    defaultValue: DEFAULT_GLOBAL_CONFIG.report.maxFiles,
    parser: parseNumber,
  },
];

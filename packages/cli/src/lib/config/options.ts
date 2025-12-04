import { DEFAULT_GLOBAL_CONFIG } from './defaults';
import type { GlobalOptionDefinition } from './types';

export function parseNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`Invalid number value "${value}".`);
  }
  return parsed;
}

export const GLOBAL_OPTION_DEFINITIONS: GlobalOptionDefinition[] = [
  {
    flags: '--verbose',
    description: 'Enable verbose output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.verbose,
  },
  {
    flags: '--region <region>',
    description: 'Storyblok region used for API requests',
    defaultValue: DEFAULT_GLOBAL_CONFIG.region,
  },
  {
    flags: '--api-max-retries <number>',
    description: 'Maximum retry attempts for HTTP requests',
    defaultValue: DEFAULT_GLOBAL_CONFIG.api.maxRetries,
    parser: parseNumber,
  },
  {
    flags: '--api-max-concurrency <number>',
    description: 'Maximum concurrent API requests executed by the CLI',
    defaultValue: DEFAULT_GLOBAL_CONFIG.api.maxConcurrency,
    parser: parseNumber,
  },
  // Boolean flags that default to true need both positive and negative forms
  {
    flags: '--log-console-enabled',
    description: 'Enable console logging output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.console.enabled,
  },
  {
    flags: '--no-log-console-enabled',
    description: 'Disable console logging output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.console.enabled,
  },
  {
    flags: '--log-console-level <level>',
    description: 'Console log level threshold',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.console.level,
  },
  {
    flags: '--log-file-enabled',
    description: 'Enable file logging output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.file.enabled,
  },
  {
    flags: '--no-log-file-enabled',
    description: 'Disable file logging output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.file.enabled,
  },
  {
    flags: '--log-file-level <level>',
    description: 'File log level threshold',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.file.level,
  },
  {
    flags: '--log-file-max-files <number>',
    description: 'Maximum amount of log files to keep on disk',
    defaultValue: DEFAULT_GLOBAL_CONFIG.log.file.maxFiles,
    parser: parseNumber,
  },
  {
    flags: '--ui-enabled',
    description: 'Enable UI output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.ui.enabled,
  },
  {
    flags: '--no-ui-enabled',
    description: 'Disable UI output',
    defaultValue: DEFAULT_GLOBAL_CONFIG.ui.enabled,
  },
  {
    flags: '--report-enabled',
    description: 'Enable report generation after command execution',
    defaultValue: DEFAULT_GLOBAL_CONFIG.report.enabled,
  },
  {
    flags: '--no-report-enabled',
    description: 'Disable report generation after command execution',
    defaultValue: DEFAULT_GLOBAL_CONFIG.report.enabled,
  },
  {
    flags: '--report-max-files <number>',
    description: 'Maximum number of report files to keep',
    defaultValue: DEFAULT_GLOBAL_CONFIG.report.maxFiles,
    parser: parseNumber,
  },
];

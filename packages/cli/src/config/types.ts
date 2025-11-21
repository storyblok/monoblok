import type { RegionCode } from '../constants';
import type { Command, Option } from 'commander';

export type PlainObject = Record<string, any>;

export interface ApiConfig {
  maxRetries: number;
  maxConcurrency: number;
}

export interface LogConsoleConfig {
  enabled: boolean;
  level: string;
}

export interface LogFileConfig {
  enabled: boolean;
  level: string;
  maxFiles: number;
}

export interface LogConfig {
  console: LogConsoleConfig;
  file: LogFileConfig;
}

export interface ReportConfig {
  enabled: boolean;
  maxFiles: number;
}

export interface GlobalConfig {
  region: RegionCode;
  api: ApiConfig;
  log: LogConfig;
  report: ReportConfig;
}

export interface ResolvedCliConfig extends GlobalConfig {
  verbose: boolean;
  [key: string]: any;
}

export type OptionParser<T> = (value: string, previous?: T) => T;

export interface GlobalOptionDefinition<T = unknown> {
  flags: string;
  description: string;
  defaultValue: T;
  parser?: OptionParser<T>;
}

export interface ConfigLocation {
  cwd: string;
  configFile: string;
}

export type CommanderOption = Option;
export type CommanderCommand = Command;

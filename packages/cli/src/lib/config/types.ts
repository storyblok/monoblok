import type { RegionCode } from '../../constants';
import type { Command, Option } from 'commander';
import type { CommandOptions } from '../../types';
import type { PullComponentsOptions } from '../../commands/components/pull/constants';
import type { PushComponentsOptions } from '../../commands/components/push/constants';
import type { PullDatasourcesOptions } from '../../commands/datasources/pull/constants';
import type { PushDatasourcesOptions } from '../../commands/datasources/push/constants';
import type { MigrationsGenerateOptions } from '../../commands/migrations/generate/constants';
import type { MigrationsRunOptions } from '../../commands/migrations/run/constants';
import type { GenerateTypesOptions } from '../../commands/types/generate/constants';
import type { DeepPartial } from '../../utils/types';

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

export interface UiConfig {
  enabled: boolean;
}

export interface GlobalConfig {
  region?: RegionCode;
  api: ApiConfig;
  log: LogConfig;
  report: ReportConfig;
  ui: UiConfig;
  verbose: boolean;
}

export interface ResolvedCliConfig extends GlobalConfig {
  [key: string]: any;
}

type StripCommandOption<T> = T extends CommandOptions ? Omit<T, keyof CommandOptions> : T;
type CommandConfig<T> = Partial<StripCommandOption<T>>;

export interface ComponentsModuleConfig extends Record<string, unknown> {
  space?: number;
  path?: string;
  pull?: CommandConfig<PullComponentsOptions>;
  push?: CommandConfig<PushComponentsOptions>;
}

export interface DatasourcesModuleConfig extends Record<string, unknown> {
  space?: number;
  path?: string;
  pull?: CommandConfig<PullDatasourcesOptions>;
  push?: CommandConfig<PushDatasourcesOptions>;
}

export interface MigrationsModuleConfig extends Record<string, unknown> {
  space?: number;
  path?: string;
  generate?: CommandConfig<MigrationsGenerateOptions>;
  run?: CommandConfig<MigrationsRunOptions>;
}

export interface TypesModuleConfig extends Record<string, unknown> {
  space?: number;
  path?: string;
  generate?: CommandConfig<GenerateTypesOptions>;
}

export type ModulesConfig = Record<string, PlainObject> & {
  components?: ComponentsModuleConfig;
  datasources?: DatasourcesModuleConfig;
  migrations?: MigrationsModuleConfig;
  types?: TypesModuleConfig;
};

export interface StoryblokConfig extends DeepPartial<GlobalConfig> {
  space?: number;
  path?: string;
  modules?: ModulesConfig;
}

export function defineConfig<T extends StoryblokConfig>(config: T): T {
  return config;
}

export type OptionParser<T> = (value: string, previous?: T) => T;

export interface GlobalOptionDefinition<T = unknown> {
  flags: string;
  description: string;
  defaultValue?: T;
  parser?: OptionParser<T>;
}

export interface ConfigLocation {
  cwd: string;
  configFile: string;
}

export type CommanderOption = Option;
export type CommanderCommand = Command;

import type { RegionCode } from '../../constants';
import type { Command, Option } from 'commander';
import type { CommandOptions } from '../../types';
import type { PullComponentsOptions } from '../../commands/components/pull/constants';
import type { PushComponentsOptions } from '../../commands/components/push/constants';
import type { PullDatasourcesOptions } from '../../commands/datasources/pull/constants';
import type { PushDatasourcesOptions } from '../../commands/datasources/push/constants';
import type { DeleteDatasourceOptions } from '../../commands/datasources/delete/constants';
import type { MigrationsGenerateOptions } from '../../commands/migrations/generate/constants';
import type { MigrationsRunOptions } from '../../commands/migrations/run/constants';
import type { MigrationsRollbackOptions } from '../../commands/migrations/rollback/types';
import type { GenerateTypesOptions } from '../../commands/types/generate/constants';
import type { PullLanguagesOptions } from '../../commands/languages/constants';
import type { PullAssetsOptions } from '../../commands/assets/pull/types';
import type { PushAssetsOptions } from '../../commands/assets/push/types';
import type { PullStoriesOptions } from '../../commands/stories/pull/types';
import type { PushStoriesOptions } from '../../commands/stories/push/types';
import type { PruneLogsOptions } from '../../commands/logs/prune/types';
import type { PruneReportsOptions } from '../../commands/reports/prune/types';
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
  space?: number | string;
  path?: string;
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

export interface SharedConfigOptions {
  space?: number | string;
  path?: string;
}

export interface CommandOptionsMap {
  components: { pull: PullComponentsOptions; push: PushComponentsOptions };
  datasources: { pull: PullDatasourcesOptions; push: PushDatasourcesOptions; delete: DeleteDatasourceOptions };
  migrations: { generate: MigrationsGenerateOptions; run: MigrationsRunOptions; rollback: MigrationsRollbackOptions };
  types: { generate: GenerateTypesOptions };
  languages: { pull: PullLanguagesOptions };
  assets: { pull: PullAssetsOptions; push: PushAssetsOptions };
  stories: { pull: PullStoriesOptions; push: PushStoriesOptions };
  logs: { list: Record<string, never>; prune: PruneLogsOptions };
  reports: { list: Record<string, never>; prune: PruneReportsOptions };
}

type SubcommandConfig<T> = SharedConfigOptions & CommandConfig<T>;

type ModuleConfig<Subs extends Record<string, any>> = SharedConfigOptions & {
  [K in keyof Subs]?: SubcommandConfig<Subs[K]>;
};

export type ModulesConfig = {
  [K in keyof CommandOptionsMap]?: ModuleConfig<CommandOptionsMap[K]>;
};

export type ComponentsModuleConfig = ModulesConfig['components'];
export type DatasourcesModuleConfig = ModulesConfig['datasources'];
export type MigrationsModuleConfig = ModulesConfig['migrations'];
export type TypesModuleConfig = ModulesConfig['types'];
export type LanguagesModuleConfig = ModulesConfig['languages'];
export type AssetsModuleConfig = ModulesConfig['assets'];
export type StoriesModuleConfig = ModulesConfig['stories'];
export type LogsModuleConfig = ModulesConfig['logs'];
export type ReportsModuleConfig = ModulesConfig['reports'];

export interface StoryblokConfig extends DeepPartial<GlobalConfig> {
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

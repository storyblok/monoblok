import type { LogLevel } from '../../../utils/logger';
import type { CommandOptions } from '../../../types';
import type { StoryContent } from '../../stories/constants';

export interface MigrationsRunOptions extends CommandOptions {
  dryRun?: boolean;
  filter?: string;
  query?: string;
  startsWith?: string;
  publish?: 'all' | 'published' | 'published-with-changes';
  ui: boolean;
  logConsole: boolean;
  logConsoleLevel: LogLevel;
  logFile: boolean;
  logFileDir: string;
  logFileMaxFiles: number;
}

export interface ReadMigrationFilesOptions {
  space: string;
  path: string;
  filter?: string;
}

export interface MigrationFile {
  name: string;
}

export interface MigrationResult {
  successful: SuccessfulMigration[];
  failed: FailedMigration[];
  skipped: SkippedMigration[];
}

export interface SuccessfulMigration {
  storyId: number;
  name: string | undefined;
  migrationNames: string[];
  content: StoryContent;
}

export interface FailedMigration {
  storyId: number;
  migrationNames: string[];
  error: unknown;
}

export interface SkippedMigration {
  storyId: number;
  name: string | undefined;
  migrationNames: string[];
  reason: string;
}

export const ERROR_CODES = {
  MIGRATION_APPLY_TO_STORY_ERROR: 'MIGRATION_APPLY_TO_STORY_ERROR',
  MIGRATION_CREATE_STORIES_PIPELINE_ERROR: 'MIGRATION_CREATE_STORIES_PIPELINE_ERROR',
  MIGRATION_FILE_NO_DEFAULT_EXPORT: 'MIGRATION_FILE_NO_DEFAULT_EXPORT',
  MIGRATION_FILE_NOT_FOUND: 'MIGRATION_FILE_NOT_FOUND',
  MIGRATION_LOAD_ERROR: 'MIGRATION_LOAD_ERROR',
  MIGRATION_STORY_CONTENT_MISSING: 'MIGRATION_STORY_CONTENT_MISSING',
  MIGRATION_STORY_FETCH_ERROR: 'MIGRATION_STORY_FETCH_ERROR',
  MIGRATION_STORY_UPDATE_ERROR: 'MIGRATION_STORY_UPDATE_ERROR',
  MIGRATION_STORY_UPDATE_NULL: 'MIGRATION_STORY_UPDATE_NULL',
};

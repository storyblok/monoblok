import type { CommandOptions } from '../../../types';
import type { StoryContent } from '../../stories/constants';

export interface MigrationsRunOptions extends CommandOptions {
  dryRun?: boolean;
  filter?: string;
  query?: string;
  startsWith?: string;
  publish?: 'all' | 'published' | 'published-with-changes';
}

export interface ReadMigrationFilesOptions {
  space: string;
  path: string;
  filter?: string;
}

export interface MigrationFile {
  name: string;
  content: string;
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

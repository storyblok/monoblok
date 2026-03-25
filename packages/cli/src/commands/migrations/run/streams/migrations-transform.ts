import { Transform } from 'node:stream';
import type { Story, StoryContent } from '../../../stories/constants';
import { ERROR_CODES, type FailedMigration, type MigrationFile, type SkippedMigration, type SuccessfulMigration } from '../constants';
import { applyMigrationToAllBlocks, getMigrationFunction } from '../actions';
import { getComponentNameFromFilename } from '../../../../utils/filesystem';
import { hash } from 'ohash';
import { saveRollbackData } from '../../rollback/actions';
import { getLogger } from '../../../../lib/logger/logger';
import { toError } from '../../../../utils/error';

export interface MigrationStreamOptions {
  migrationFiles: MigrationFile[];
  space: string;
  path: string;
  componentName?: string;
  onProgress: (current: number) => void;
  onTotal: (total: number) => void;
}

export interface MigrationStreamResult {
  successful: SuccessfulMigration[];
  failed: FailedMigration[];
  skipped: SkippedMigration[];
  totalProcessed: number;
}

/**
 * Transform stream that processes stories and applies migrations to them
 * Outputs successful migration results for further processing by update streams
 */
export class MigrationStream extends Transform {
  private timestamp: number = Date.now();
  private results: MigrationStreamResult;
  private migrationFunctions: Map<string, ((block: any) => any) | null> = new Map();
  private totalProcessed: number = 0;

  constructor(private options: MigrationStreamOptions) {
    super({
      objectMode: true,
    });

    this.results = {
      successful: [],
      failed: [],
      skipped: [],
      totalProcessed: 0,
    };
  }

  async _transform(chunk: Story, _encoding: string, callback: (error?: Error | null, data?: any) => void) {
    try {
      const results = await this.processStory(chunk);

      this.results.totalProcessed++;
      this.options.onProgress?.(this.results.totalProcessed);

      // Output successful migration results for further processing
      if (results.length > 0) {
        this.totalProcessed += results.length;
        this.options.onTotal?.(this.totalProcessed);
        for (const result of results) {
          this.push(result);
        }
      }

      callback();
    }
    catch (error) {
      callback(error as Error);
    }
  }

  private async getOrLoadMigrationFunction(migrationFile: MigrationFile) {
    if (this.migrationFunctions.has(migrationFile.name)) {
      return this.migrationFunctions.get(migrationFile.name);
    }

    const migrationFunction = await getMigrationFunction(
      migrationFile.name,
      this.options.space,
      this.options.path,
    );
    this.migrationFunctions.set(migrationFile.name, migrationFunction);

    return migrationFunction;
  }

  private async processStory(story: Story): Promise<Array<{ storyId: number; name: string | undefined; content: StoryContent; published?: boolean; unpublished_changes?: boolean }>> {
    // Filter migrations based on component name if provided
    const relevantMigrations = this.options.componentName
      ? this.options.migrationFiles.filter((file) => {
          const targetComponent = getComponentNameFromFilename(file.name);
          return targetComponent.split('.')[0] === this.options.componentName;
        })
      : this.options.migrationFiles;

    if (!story.content) {
      this.results.failed.push({
        storyId: story.id,
        migrationNames: relevantMigrations.map(m => m.name),
        error: new Error('Story content is missing'),
      });
      getLogger().error('Failed to process story: Content is missing', {
        storyId: story.id,
        errorCode: ERROR_CODES.MIGRATION_STORY_CONTENT_MISSING,
      });
      return [];
    }

    const successfulResults: Array<{ storyId: number; name: string | undefined; content: StoryContent; published?: boolean; unpublished_changes?: boolean }> = [];

    // Process each relevant migration
    const result = await this.applyMigrationsToStory(story, relevantMigrations);
    if (result) {
      successfulResults.push(result);
    }

    return successfulResults;
  }

  private async applyMigrationsToStory(story: Story, migrationFiles: MigrationFile[]): Promise<{ storyId: number; name: string | undefined; content: StoryContent; published?: boolean; unpublished_changes?: boolean } | null> {
    const migrationNames = migrationFiles.map(f => f.name);

    try {
      const storyContent = structuredClone(story.content) as StoryContent;
      const originalContentHash = hash(storyContent);

      let processed = false;
      for (const migrationFile of migrationFiles) {
        const migrationFunction = await this.getOrLoadMigrationFunction(migrationFile);
        if (!migrationFunction) {
          const error = new Error(`Failed to load migration function from file "${migrationFile.name}"`);
          this.results.failed.push({
            storyId: story.id,
            migrationNames,
            error,
          });
          getLogger().error(error.message, {
            errorCode: ERROR_CODES.MIGRATION_FILE_NOT_FOUND,
          });
          return null;
        }

        const targetComponent = this.options.componentName || getComponentNameFromFilename(migrationFile.name);
        const migrationProcessed = applyMigrationToAllBlocks(storyContent, migrationFunction, targetComponent);
        processed = processed || migrationProcessed;
      }

      const newContentHash = hash(storyContent);
      const contentChanged = originalContentHash !== newContentHash;

      if (processed && contentChanged) {
        // Save rollback data before applying migration
        await saveRollbackData({
          space: this.options.space,
          path: this.options.path,
          story: {
            id: story.id,
            name: story.name || '',
            content: story.content as StoryContent,
            published: story.published,
            unpublished_changes: story.unpublished_changes,
          },
          migrationTimestamp: this.timestamp,
          migrationNames,
        });

        this.results.successful.push({
          storyId: story.id,
          name: story.name,
          migrationNames,
          content: storyContent,
        });
        getLogger().info('Applied migration', { storyId: story.id, migrationNames });

        return {
          storyId: story.id,
          name: story.name,
          content: storyContent,
          published: story.published,
          unpublished_changes: story.unpublished_changes,
        };
      }
      else if (processed && !contentChanged) {
        this.results.skipped.push({
          storyId: story.id,
          name: story.name,
          migrationNames,
          reason: 'No changes detected after migration',
        });
        getLogger().info('Skipped migration: No changes detected', { storyId: story.id, migrationNames });
        return null;
      }
      else {
        const reason = migrationFiles.map((migrationFile) => {
          const targetComponent = this.options.componentName || getComponentNameFromFilename(migrationFile.name);
          const baseComponent = targetComponent.split('.')[0];
          return baseComponent === this.options.componentName ? `No matching components found for ${migrationFile.name}` : `Different component target ${migrationFile.name}`;
        }).join('\n');

        this.results.skipped.push({
          storyId: story.id,
          name: story.name,
          migrationNames,
          reason,
        });
        getLogger().info(`Skipped migration: ${reason}`, { storyId: story.id, migrationNames });
        return null;
      }
    }
    catch (maybeError) {
      const error = toError(maybeError);
      this.results.failed.push({
        storyId: story.id,
        migrationNames,
        error,
      });
      getLogger().error(error.message, {
        storyId: story.id,
        migrationNames,
        error,
        errorCode: ERROR_CODES.MIGRATION_APPLY_TO_STORY_ERROR,
      });
      return null;
    }
  }

  _flush(callback: (error?: Error | null) => void) {
    callback();
  }

  /**
   * Get the migration results
   */
  getResults(): MigrationStreamResult {
    return this.results;
  }

  /**
   * Get a summary of the migration results
   */
  getSummary(): string {
    const { successful, failed, skipped } = this.results;

    const successfulStoryIds = new Set(successful.map(result => result.storyId));

    let summary = `Migration Results: ${successfulStoryIds.size} stories updated, ${skipped.length} stories skipped`;

    if (skipped.length > 0) {
      const skippedByReason = skipped.reduce((acc, item) => {
        if (!acc[item.reason]) {
          acc[item.reason] = 0;
        }
        acc[item.reason]++;
        return acc;
      }, {} as Record<string, number>);
      const skippedReasons = Object.entries(skippedByReason)
        .map(([reason, count]) => `${reason}: ${count}`)
        .join(', ');

      summary += ` (${skippedReasons})`;
    }

    if (failed.length > 0) {
      const failedStoryIds = new Set(failed.map(result => result.storyId));
      summary += `, ${failedStoryIds.size} stories failed`;
    }

    summary += `.`;
    return summary;
  }
}

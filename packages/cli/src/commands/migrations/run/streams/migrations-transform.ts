import { Transform } from 'node:stream';
import type { Story, StoryContent } from '../../../stories/constants';
import type { FailedMigration, MigrationFile, SkippedMigration, SuccessfulMigration } from '../constants';
import { applyMigrationToAllBlocks, getMigrationFunction } from '../actions';
import { getComponentNameFromFilename } from '../../../../utils/filesystem';
import { hash } from 'ohash';
import { saveRollbackData } from '../../rollback/actions';

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

  private async processStory(story: Story): Promise<Array<{ storyId: number; name: string | undefined; content: StoryContent }>> {
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
      return [];
    }

    const successfulResults: Array<{ storyId: number; name: string | undefined; content: StoryContent }> = [];

    // Process each relevant migration
    const result = await this.applyMigrationsToStory(story, relevantMigrations);
    if (result) {
      successfulResults.push(result);
    }

    return successfulResults;
  }

  private async applyMigrationsToStory(story: Story, migrationFiles: MigrationFile[]): Promise<{ storyId: number; name: string | undefined; content: StoryContent } | null> {
    const migrationNames = migrationFiles.map(f => f.name);

    try {
      const storyContent = structuredClone(story.content) as StoryContent;
      const originalContentHash = hash(storyContent);

      let processed = false;
      for (const migrationFile of migrationFiles) {
        const migrationFunction = await this.getOrLoadMigrationFunction(migrationFile);
        if (!migrationFunction) {
          this.results.failed.push({
            storyId: story.id,
            migrationNames,
            error: new Error(`Failed to load migration function from file "${migrationFile.name}"`),
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
          story: { id: story.id, name: story.name || '', content: story.content as StoryContent },
          migrationTimestamp: this.timestamp,
          migrationNames,
        });

        this.results.successful.push({
          storyId: story.id,
          name: story.name,
          migrationNames,
          content: storyContent,
        });

        return {
          storyId: story.id,
          name: story.name,
          content: storyContent,
        };
      }
      else if (processed && !contentChanged) {
        this.results.skipped.push({
          storyId: story.id,
          name: story.name,
          migrationNames,
          reason: 'No changes detected after migration',
        });
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
        return null;
      }
    }
    catch (error) {
      this.results.failed.push({
        storyId: story.id,
        migrationNames,
        error,
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

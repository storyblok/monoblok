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

  _transform(chunk: Story, _encoding: string, callback: (error?: Error | null, data?: any) => void) {
    try {
      this.processStory(chunk).then((results) => {
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
      });

      callback();
    }
    catch (error) {
      callback(error as Error);
    }
  }

  private async processStory(story: Story): Promise<Array<{ storyId: number; name: string | undefined; content: StoryContent }>> {
    if (!story.content) {
      // Mark all migrations as failed for this story
      for (const migrationFile of this.options.migrationFiles) {
        this.results.failed.push({
          storyId: story.id,
          migrationName: migrationFile.name,
          error: new Error('Story content is missing'),
        });
      }
      return [];
    }

    // Filter migrations based on component name if provided
    const relevantMigrations = this.options.componentName
      ? this.options.migrationFiles.filter((file) => {
          const targetComponent = getComponentNameFromFilename(file.name);
          return targetComponent.split('.')[0] === this.options.componentName;
        })
      : this.options.migrationFiles;

    const successfulResults: Array<{ storyId: number; name: string | undefined; content: StoryContent }> = [];

    // Process each relevant migration
    for (const migrationFile of relevantMigrations) {
      const result = await this.applyMigrationToStory(story, migrationFile);
      if (result) {
        successfulResults.push(result);
      }
    }

    return successfulResults;
  }

  private async applyMigrationToStory(story: Story, migrationFile: MigrationFile): Promise<{ storyId: number; name: string | undefined; content: StoryContent } | null> {
    try {
      // Get or load the migration function
      let migrationFunction = this.migrationFunctions.get(migrationFile.name);
      if (!migrationFunction) {
        migrationFunction = await getMigrationFunction(
          migrationFile.name,
          this.options.space,
          this.options.path,
        );
        this.migrationFunctions.set(migrationFile.name, migrationFunction);
      }

      if (!migrationFunction) {
        this.results.failed.push({
          storyId: story.id,
          migrationName: migrationFile.name,
          error: new Error(`Failed to load migration function from file "${migrationFile.name}"`),
        });
        return null;
      }

      // Save rollback data before applying migration
      await saveRollbackData({
        space: this.options.space,
        path: this.options.path,
        stories: [{ id: story.id, name: story.name || '', content: story.content as StoryContent }],
        migrationFile: migrationFile.name,
      });

      // Create a deep copy of the story content
      const storyContent = structuredClone(story.content) as StoryContent;

      // Calculate original content hash
      const originalContentHash = hash(story.content);

      // Determine the target component
      const targetComponent = this.options.componentName || getComponentNameFromFilename(migrationFile.name);

      // Apply the migration
      const modified = applyMigrationToAllBlocks(storyContent, migrationFunction, targetComponent);

      // Calculate new content hash
      const newContentHash = hash(storyContent);

      // Check if content was actually modified
      const contentChanged = originalContentHash !== newContentHash;

      if (modified && contentChanged) {
        this.results.successful.push({
          storyId: story.id,
          name: story.name,
          migrationName: migrationFile.name,
          content: storyContent,
        });

        return {
          storyId: story.id,
          name: story.name,
          content: storyContent,
        };
      }
      else if (modified && !contentChanged) {
        this.results.skipped.push({
          storyId: story.id,
          name: story.name,
          migrationName: migrationFile.name,
          reason: 'No changes detected after migration',
        });
        return null;
      }
      else {
        const baseComponent = targetComponent.split('.')[0];
        this.results.skipped.push({
          storyId: story.id,
          name: story.name,
          migrationName: migrationFile.name,
          reason: baseComponent === this.options.componentName ? 'No matching components found' : 'Different component target',
        });
        return null;
      }
    }
    catch (error) {
      this.results.failed.push({
        storyId: story.id,
        migrationName: migrationFile.name,
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

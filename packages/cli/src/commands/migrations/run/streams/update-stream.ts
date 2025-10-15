import { Writable } from 'node:stream';
import type { Story, StoryContent } from '../../../stories/constants';
import { updateStory } from '../../../stories/actions';
import { isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from '../../../stories/utils';
import { Sema } from 'async-sema';

export interface UpdateStreamOptions {
  space: string;
  publish?: 'all' | 'published' | 'published-with-changes';
  dryRun?: boolean;
  batchSize?: number;
  onProgress?: (current: number) => void;
  onTotal?: (total: number) => void;
}

export interface UpdateStreamResult {
  successful: Array<{ storyId: number; name: string }>;
  failed: Array<{ storyId: number; name: string; error: Error }>;
  totalProcessed: number;
}

/**
 * Writable stream that updates stories in Storyblok with migrated content
 * This stream accepts successful migration results and applies them to Storyblok
 */
export class UpdateStream extends Writable {
  private results: UpdateStreamResult;
  private readonly batchSize: number;
  private semaphore: Sema;

  constructor(private options: UpdateStreamOptions) {
    super({
      objectMode: true,
    });

    this.batchSize = options.batchSize || 10;
    this.results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
    };

    this.semaphore = new Sema(this.batchSize, {
      capacity: this.batchSize,
    });
  }

  async _write(chunk: { storyId: number; name: string | undefined; content: StoryContent; published?: boolean; unpublished_changes?: boolean }, _encoding: string, callback: (error?: Error | null) => void) {
    try {
      await this.semaphore.acquire();

      this.updateStory(chunk).finally(() => {
        this.semaphore.release();
      });

      callback();
    }
    catch (error) {
      callback(error as Error);
    }
  }

  private async updateStory(migrationResult: { storyId: number; name: string | undefined; content: StoryContent; published?: boolean; unpublished_changes?: boolean }): Promise<void> {
    const { storyId, name, content, published, unpublished_changes } = migrationResult;
    const storyName = name || storyId.toString();

    try {
      const payload: {
        story: Story;
        force_update?: string;
        publish?: number;
      } = {
        story: {
          content,
          id: storyId,
          name: storyName,
        },
        force_update: '1',
      };

      // Determine if we should publish based on options using actual story data
      if (this.options.publish === 'published' && isStoryPublishedWithoutChanges({ published, unpublished_changes })) {
        payload.publish = 1;
      }
      else if (this.options.publish === 'published-with-changes' && isStoryWithUnpublishedChanges({ published, unpublished_changes })) {
        payload.publish = 1;
      }
      else if (this.options.publish === 'all') {
        payload.publish = 1;
      }

      const updatedStory = !this.options.dryRun && await updateStory(this.options.space, storyId, payload);
      const isStoryUpdated = Boolean(updatedStory);
      if (isStoryUpdated || this.options.dryRun) {
        this.results.successful.push({ storyId, name: storyName });
        this.results.totalProcessed++;
        this.options.onProgress?.(this.results.totalProcessed);
      }
      else {
        this.results.failed.push({
          storyId,
          name: storyName,
          error: new Error('Update returned null'),
        });
        this.results.totalProcessed++;
        this.options.onProgress?.(this.results.totalProcessed);
      }
    }
    catch (error) {
      this.results.failed.push({
        storyId,
        name: storyName,
        error: error as Error,
      });
      this.results.totalProcessed++;
      this.options.onProgress?.(this.results.totalProcessed);
    }
  }

  async _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    try {
      // Process any remaining items
      await this.semaphore.drain();
      callback();
    }
    catch (batchError) {
      callback(batchError as Error);
      return;
    }

    callback(error);
  }

  /**
   * Get the update results
   */
  getResults(): UpdateStreamResult {
    return this.results;
  }

  /**
   * Get a summary of the update results
   */
  getSummary(): string {
    const { successful, failed, totalProcessed } = this.results;

    if (totalProcessed === 0) {
      return `No stories required updates.`;
    }

    let summary = `Update Results: ${successful.length} stories updated`;

    if (failed.length > 0) {
      summary += `, ${failed.length} stories failed`;
    }

    summary += `.`;
    return summary;
  }
}

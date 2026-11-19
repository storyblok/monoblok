import { Writable } from "node:stream";
import type { Sema } from "async-sema";
import type { StoryUpdate } from "../../../../types";
import type { BlokContent } from "../../../stories/constants";
import { updateStory } from "../../../stories/actions";
import {
  isStoryPublishedWithoutChanges,
  isStoryWithUnpublishedChanges,
} from "../../../stories/utils";
import { getLogger } from "../../../../lib/logger/logger";
import { createPipelineBackpressureLock } from "../../../../utils/backpressure-lock";
import { ERROR_CODES, type FailedStory } from "../constants";
import { plural } from "../../content-migrations";
import { toError } from "../../../../utils/error";
import { isSystemicError } from "../failed-stories";

export interface UpdateStreamOptions {
  space: string;
  publish?: "all" | "published" | "published-with-changes";
  dryRun?: boolean;
  onProgress?: (current: number) => void;
  onTotal?: (total: number) => void;
  onError?: (failed: FailedStory) => void;
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
  private semaphore: Sema;

  constructor(private options: UpdateStreamOptions) {
    super({
      objectMode: true,
    });

    this.results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
    };

    this.semaphore = createPipelineBackpressureLock();
  }

  async _write(
    chunk: {
      storyId: number;
      name: string | undefined;
      full_slug?: string;
      content: BlokContent;
      published?: boolean;
      unpublished_changes?: boolean;
    },
    _encoding: string,
    callback: (error?: Error | null) => void,
  ) {
    try {
      await this.semaphore.acquire();
      if (this.destroyed) {
        // The run was stopped while this story waited for a slot.
        this.semaphore.release();
        callback();
        return;
      }

      this.updateStory(chunk)
        .catch((maybeError) => {
          // `updateStory` records its own failures. This only keeps a bug in it
          // from becoming an unhandled rejection that ends the process mid-run.
          const error = toError(maybeError);
          getLogger().error(error.message, {
            storyId: chunk.storyId,
            storyName: chunk.name,
            error,
            errorCode: ERROR_CODES.MIGRATION_STORY_UPDATE_ERROR,
          });
        })
        .finally(() => {
          this.semaphore.release();
        });

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  private async updateStory(migrationResult: {
    storyId: number;
    name: string | undefined;
    full_slug?: string;
    content: BlokContent;
    published?: boolean;
    unpublished_changes?: boolean;
  }): Promise<void> {
    const { storyId, name, full_slug, content, published, unpublished_changes } = migrationResult;
    const storyName = name || storyId.toString();

    try {
      const payload: {
        story: StoryUpdate;
        force_update?: string;
        publish?: number;
      } = {
        story: {
          content,
          name: storyName,
        },
        force_update: "1",
      };

      // Determine if we should publish based on options using actual story data
      if (
        this.options.publish === "published" &&
        isStoryPublishedWithoutChanges({ published, unpublished_changes })
      ) {
        payload.publish = 1;
      } else if (
        this.options.publish === "published-with-changes" &&
        isStoryWithUnpublishedChanges({ published, unpublished_changes })
      ) {
        payload.publish = 1;
      } else if (this.options.publish === "all") {
        payload.publish = 1;
      }

      const updatedStory =
        !this.options.dryRun && (await updateStory(this.options.space, storyId, payload));
      const isStoryUpdated = Boolean(updatedStory);
      if (isStoryUpdated || this.options.dryRun) {
        this.results.successful.push({ storyId, name: storyName });
        this.results.totalProcessed++;
        this.options.onProgress?.(this.results.totalProcessed);
        getLogger().info("Updated story", { storyId });
      } else {
        const error = new Error("Update returned null");
        this.recordFailure({ storyId, name: storyName, full_slug, error });
        getLogger().error(`Failed to update story: ${error.message}`, {
          storyId,
          storyName,
          errorCode: ERROR_CODES.MIGRATION_STORY_UPDATE_NULL,
        });
      }
    } catch (maybeError) {
      const error = toError(maybeError);
      this.recordFailure({ storyId, name: storyName, full_slug, error });
      getLogger().error(error.message, {
        storyId,
        storyName,
        error,
        errorCode: ERROR_CODES.MIGRATION_STORY_UPDATE_ERROR,
      });
      if (isSystemicError(error)) {
        // Every remaining story would fail the same way, so stop the run.
        this.destroy(error);
      }
    }
  }

  private recordFailure(failed: FailedStory & { name: string }): void {
    this.results.failed.push(failed);
    this.results.totalProcessed++;
    this.options.onProgress?.(this.results.totalProcessed);
    this.options.onError?.(failed);
  }

  async _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    try {
      // Process any remaining items
      await this.semaphore.drain();
    } catch (batchError) {
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

    const updated = this.options.dryRun ? "would be updated" : "updated";
    let summary = `Update Results: ${plural(successful.length, "story", "stories")} ${updated}`;

    if (failed.length > 0) {
      summary += `, ${plural(failed.length, "story", "stories")} failed`;
    }

    summary += `.`;
    return summary;
  }
}

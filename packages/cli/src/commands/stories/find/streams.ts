import { Transform, Writable } from "node:stream";
import { toError } from "../../../utils/error/error";
import { createPipelineBackpressureLock } from "../../../utils/backpressure-lock";
import type { Story } from "../constants";
import { applyClientFilters } from "./actions";
import { CAPI_BATCH_SIZE, CAPI_MAX_IN_FLIGHT_BATCHES } from "./capi";
import type { CapiContentFetcher, StoryContent } from "./capi";
import type { ClientFilter } from "./types";

/**
 * Drops stories before their content is fetched.
 *
 * The single-story fetch is the expensive part of the pipeline, so any filter
 * that can be decided from the list response belongs here rather than at the
 * end. `--publish-status changed` is the case that motivated it: `published`
 * and `unpublished_changes` both ride along on the list response, so filtering
 * afterwards meant fetching every published story to keep a handful.
 */
export const filterListedStoriesStream = ({
  filters,
  onDropped,
}: {
  filters: ClientFilter[];
  onDropped?: (story: Story) => void;
}) =>
  new Transform({
    objectMode: true,
    transform(story: Story, _encoding, callback) {
      if (applyClientFilters(story, filters)) {
        this.push(story);
      } else {
        onDropped?.(story);
      }
      callback();
    },
  });

/**
 * Terminal stage of the find pipeline: decides which stories reach the caller.
 *
 * Filtering is CPU-only, so this stage needs no concurrency control of its own —
 * it is the fan-in point for the parallel content fetches upstream. A filter
 * that throws on one story is reported and that story dropped, so a single odd
 * document cannot abort a whole run.
 *
 * `isAlreadyMatched` lets an upstream stage settle a story for good: under
 * `--capi-filter` the filters have already run against that story's content,
 * and running them again here would cost time without changing the verdict.
 */
export const filterStoriesStream = ({
  filters,
  isAlreadyMatched,
  onMatch,
  onSkip,
  onIncrement,
  onStoryError,
}: {
  filters: ClientFilter[];
  /** Decided upstream: a match, with no filters left to evaluate. */
  isAlreadyMatched?: (story: Story) => boolean;
  onMatch?: (story: Story) => void;
  onSkip?: (story: Story) => void;
  onIncrement?: () => void;
  onStoryError?: (error: Error, story: Story) => void;
}) =>
  new Writable({
    objectMode: true,
    write(story: Story, _encoding, callback) {
      try {
        if (isAlreadyMatched?.(story) === true || applyClientFilters(story, filters)) {
          onMatch?.(story);
        } else {
          onSkip?.(story);
        }
      } catch (maybeError) {
        onStoryError?.(toError(maybeError), story);
      } finally {
        onIncrement?.();
        callback();
      }
    },
  });

export interface JsonlWriter {
  push: (value: unknown) => void;
  flush: () => void;
}

/**
 * Emits one JSON document per line on stdout.
 *
 * Progress bars redraw in place on stderr. When stdout points at the same
 * terminal, writing a result mid-render scrolls the bars out of position and
 * garbles both streams, so results are buffered and flushed once the bars have
 * stopped. When stdout is piped or redirected the two never share a device, so
 * results stream out as they match and `… | head -5` stays responsive.
 */
export function createJsonlWriter({
  write,
  buffered = process.stdout.isTTY === true,
}: {
  write: (line: string) => void;
  buffered?: boolean;
}): JsonlWriter {
  const pending: string[] = [];

  return {
    push(value) {
      const line = JSON.stringify(value);
      if (buffered) {
        pending.push(line);
      } else {
        write(line);
      }
    },
    flush() {
      for (const line of pending) {
        write(line);
      }
      pending.length = 0;
    },
  };
}

/**
 * Replaces the per-story MAPI content fetch with one CAPI page per 25 stories,
 * for the sole purpose of deciding which stories are still worth fetching.
 *
 * The stage only ever *prunes*. A story CAPI does not answer for — a folder, a
 * story the CDN has not got, a batch that failed — passes through undecided, so
 * the exact answer still comes from MAPI content downstream. That is what keeps
 * the result set identical to a run without the flag, and why the `--where`
 * filters are applied twice: cheaply here against CAPI content, then
 * authoritatively against the MAPI story.
 *
 * List metadata is merged under the CAPI content before filtering, so a
 * story-level expression (`$[?($.updated_at > …)]`) decides here too rather than
 * falling through to a fetch.
 */
export const capiFilterStream = ({
  fetchContent,
  filters,
  batchSize = CAPI_BATCH_SIZE,
  maxInFlightBatches = CAPI_MAX_IN_FLIGHT_BATCHES,
  onCandidate,
  onPruned,
  onUnresolved,
  onBatchSettled,
  onBatchError,
}: {
  fetchContent: CapiContentFetcher;
  filters: ClientFilter[];
  batchSize?: number;
  maxInFlightBatches?: number;
  /** Matched here, so its MAPI content is still fetched for the output. */
  onCandidate?: (story: Story) => void;
  /** Decided here, so no MAPI content fetch happens for it at all. */
  onPruned?: (story: Story) => void;
  /** CAPI had no content for it, so it passes through unfiltered. */
  onUnresolved?: (story: Story) => void;
  onBatchSettled?: (size: number) => void;
  onBatchError?: (error: Error, size: number) => void;
}) => {
  const lock = createPipelineBackpressureLock(maxInFlightBatches);
  const processing = new Set<Promise<void>>();
  let batch: Story[] = [];

  /**
   * Resolves one batch and decides each of its stories.
   *
   * `push` is passed in rather than captured so the batch handler stays a plain
   * function: the stream's `push` is only reachable as `this` inside the stream's
   * own methods.
   */
  const settleBatch = async (pending: Story[], push: (story: Story) => void): Promise<void> => {
    let contentByUuid: Map<string, StoryContent> | undefined;

    try {
      contentByUuid = await fetchContent(pending.map((story) => story.uuid).filter(Boolean));
    } catch (maybeError) {
      // A failed batch decides nothing: every story in it falls through to its
      // MAPI fetch, which costs time but cannot change the answer.
      onBatchError?.(toError(maybeError), pending.length);
    }

    for (const story of pending) {
      const content = story.uuid ? contentByUuid?.get(story.uuid) : undefined;
      if (!content) {
        onUnresolved?.(story);
        push(story);
        continue;
      }

      try {
        if (applyClientFilters({ ...story, content }, filters)) {
          onCandidate?.(story);
          push(story);
        } else {
          onPruned?.(story);
        }
      } catch {
        // A filter that throws on CAPI content must not prune: the story reaches
        // the authoritative pass, which reports the failure itself.
        onUnresolved?.(story);
        push(story);
      }
    }

    onBatchSettled?.(pending.length);
  };

  return new Transform({
    objectMode: true,
    async transform(story: Story, _encoding, callback) {
      batch.push(story);
      if (batch.length < batchSize) {
        callback();
        return;
      }

      const pending = batch;
      batch = [];
      // Awaited before the callback, so a saturated queue holds the pager back
      // rather than buffering the whole space in memory.
      await lock.acquire();
      const task = settleBatch(pending, (resolved) => this.push(resolved)).finally(() => {
        lock.release();
        processing.delete(task);
      });
      processing.add(task);

      callback();
    },
    // The last batch is almost never full, and in-flight batches have to finish
    // before the stage can end.
    flush(callback) {
      const tail = batch;
      batch = [];
      const remaining =
        tail.length > 0 ? settleBatch(tail, (resolved) => this.push(resolved)) : Promise.resolve();
      Promise.all([...processing, remaining]).finally(() => callback());
    },
  });
};

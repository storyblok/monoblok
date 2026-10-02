import { Transform } from "node:stream";
import { toError } from "../../../utils/error/error";
import { createPipelineBackpressureLock } from "../../../utils/backpressure-lock";
import type { Story } from "../constants";
import { applyClientFilters } from "./actions";
import { CAPI_BATCH_SIZE, CAPI_MAX_IN_FLIGHT_BATCHES, stripEditorMarkers } from "./capi";
import type { CapiContentFetcher, StoryContent } from "./capi";
import type { ClientFilter } from "./types";

/**
 * Drops stories before their content is fetched. The per-story fetch is the
 * expensive part of the pipeline, so any filter decidable from the list response
 * (such as `--publish-status`) belongs here rather than at the end.
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
 * Last deciding stage of the find pipeline: what it pushes is a result.
 *
 * Filtering is CPU-only, so this stage needs no concurrency control of its own —
 * it is the fan-in point for the parallel content fetches upstream. A filter
 * that throws on one story is reported and that story dropped, so a single odd
 * document cannot abort a whole run.
 *
 * Matches are pushed on to the sink below rather than handed to a callback,
 * which is what puts the sink's backpressure behind them: a reader slower than
 * this run holds the pipeline back instead of having the result set buffered
 * ahead of it.
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
  new Transform({
    objectMode: true,
    transform(story: Story, _encoding, callback) {
      try {
        if (isAlreadyMatched?.(story) === true || applyClientFilters(story, filters)) {
          onMatch?.(story);
          this.push(story);
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

/**
 * Replaces the per-story MAPI content fetch with one CAPI page per 25 stories,
 * to decide which stories are still worth fetching.
 *
 * The stage only ever prunes: a story it cannot decide (a folder, a story the
 * CDN has not got, a failed batch) passes through and is decided downstream.
 *
 * A story it matches is not re-tested on MAPI content. Under the default
 * `version=draft` both are the same document; when `--capi-params` asks for
 * another (published content, a translation), the match is decided on that
 * document while the emitted story is still the MAPI one.
 *
 * `attachContent` turns the stage into a bulk content source: the content rides
 * along on the story instead of being discarded, for a consumer that would
 * otherwise fetch each story individually. Off by default, because `find`
 * re-fetches every match from MAPI and emits that.
 */
export const capiFilterStream = ({
  fetchContent,
  filters,
  attachContent = false,
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
  /** Forward the CAPI content on the story instead of discarding it. */
  attachContent?: boolean;
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
   * The first error a detached batch failed with. `transform` has already
   * called back by the time a batch rejects, so `flush` ends the stage with it.
   */
  let failure: Error | undefined;

  /** First failure wins; the ones after it are consequences of the same stop. */
  const recordFailure = (error: unknown): void => {
    failure ??= toError(error);
  };

  /** The last batch queued for emission; each batch waits for it, so output keeps listing order. */
  let previousEmit: Promise<void> = Promise.resolve();

  /** Fetches one batch and decides each of its stories, returning those to forward. */
  const settleBatch = async (pending: Story[]): Promise<Story[]> => {
    let contentByUuid: Map<string, StoryContent> | undefined;

    try {
      contentByUuid = await fetchContent(pending.map((story) => story.uuid).filter(Boolean));
    } catch (maybeError) {
      // A failed batch decides nothing: every story in it falls through to its
      // MAPI fetch, which costs time but cannot change the answer.
      onBatchError?.(toError(maybeError), pending.length);
    }

    const forward: Story[] = [];
    for (const story of pending) {
      const content = story.uuid ? contentByUuid?.get(story.uuid) : undefined;
      if (!content) {
        onUnresolved?.(story);
        forward.push(story);
        continue;
      }

      try {
        const withContent = { ...story, content };
        if (applyClientFilters(withContent, filters)) {
          onCandidate?.(story);
          // Filters run against the content as served, so `_editable` is only
          // stripped from what is forwarded, never from what is tested.
          forward.push(attachContent ? { ...story, content: stripEditorMarkers(content) } : story);
        } else {
          onPruned?.(story);
        }
      } catch {
        // A filter that throws on CAPI content must not prune: the story reaches
        // the authoritative pass, which reports the failure itself.
        onUnresolved?.(story);
        forward.push(story);
      }
    }

    onBatchSettled?.(pending.length);
    return forward;
  };

  /** Settles `pending` and pushes its stories once every earlier batch has been pushed. */
  const queueBatch = (pending: Story[], push: (story: Story) => void): Promise<void> => {
    previousEmit = Promise.all([settleBatch(pending), previousEmit]).then(([stories]) => {
      for (const story of stories) {
        push(story);
      }
    });
    return previousEmit;
  };

  return new Transform({
    objectMode: true,
    async transform(story: Story, _encoding, callback) {
      // Node does not observe the promise an `async transform` returns, so a
      // throw on the way to `callback()` would surface as an unhandled rejection
      // rather than as a pipeline failure — and the stage would stall on a
      // callback that never comes.
      try {
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
        const task = queueBatch(pending, (resolved) => this.push(resolved))
          .catch(recordFailure)
          .finally(() => {
            lock.release();
            processing.delete(task);
          });
        processing.add(task);

        callback();
      } catch (maybeError) {
        callback(toError(maybeError));
      }
    },
    // The last batch is almost never full, and in-flight batches have to finish
    // before the stage can end.
    flush(callback) {
      const tail = batch;
      batch = [];
      const remaining =
        tail.length > 0
          ? queueBatch(tail, (resolved) => this.push(resolved)).catch(recordFailure)
          : Promise.resolve();
      // `.finally` would run the callback and then re-throw into nothing, ending
      // the stage successfully while an unhandled rejection escaped the process.
      Promise.all([...processing, remaining]).then(
        () => callback(failure),
        (error: unknown) => callback(toError(error)),
      );
    },
  });
};

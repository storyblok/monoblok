import { Transform, Writable } from "node:stream";
import { toError } from "../../../utils/error/error";
import type { Story } from "../constants";
import { applyClientFilters } from "./actions";
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
 */
export const filterStoriesStream = ({
  filters,
  onMatch,
  onSkip,
  onIncrement,
  onStoryError,
}: {
  filters: ClientFilter[];
  onMatch?: (story: Story) => void;
  onSkip?: (story: Story) => void;
  onIncrement?: () => void;
  onStoryError?: (error: Error, story: Story) => void;
}) =>
  new Writable({
    objectMode: true,
    write(story: Story, _encoding, callback) {
      try {
        if (applyClientFilters(story, filters)) {
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

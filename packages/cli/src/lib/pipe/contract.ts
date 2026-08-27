import type { Readable } from "node:stream";
import type { Story } from "../../types";
import { CommandError } from "../../utils/error/command-error";
import { createJsonlSource } from "./input";

/**
 * The shape of one line on the wire between two CLI commands.
 *
 * A line is a **complete story as the Management API returned it**, not a
 * reference to one. A consumer takes the fields it needs off the line and
 * re-fetches only what the line does not carry — that is what makes
 * `find … | migrations run -` cost no reads at all on the right-hand side, which
 * is the entire point of the pipe.
 *
 * Two consequences a consumer has to hold up:
 *
 * - **`content` is optional.** A producer run with `--skip-content` emits list
 *   metadata only. {@link hasContent} is the check; a consumer that needs content
 *   fetches it for the lines that lack it rather than failing the run.
 * - **A line is a snapshot.** Between the producer reading a story and the
 *   consumer writing it, the story can be edited or moved. `updated_at` rides
 *   along on every line and is the token to compare before an overwrite; a
 *   command that sends `force_update` on piped input is discarding a concurrent
 *   edit without a word.
 */
export type StoryLine = Story & {
  id: NonNullable<Story["id"]>;
  uuid: NonNullable<Story["uuid"]>;
  full_slug: NonNullable<Story["full_slug"]>;
  /** Sidecar keys, per {@link isSidecarKey}. */
  [sidecar: string]: unknown;
};

/**
 * The fields every line carries, whatever flags produced it.
 *
 * The floor exists so a consumer can be written against the format rather than
 * against one producer's flag combination: `id` addresses the story for a write,
 * `uuid` addresses it across spaces, and `full_slug` is what any report about it
 * has to say out loud.
 */
export const REQUIRED_STORY_LINE_FIELDS = ["id", "uuid", "full_slug"] as const;

/**
 * The prefix marking a key a producer added, which is not part of the story
 * object itself — `_ref_issues` from `--check-references` is the first of them.
 *
 * The convention is what lets producers annotate lines without every consumer
 * having to learn each annotation: unknown sidecar keys are ignored, and
 * {@link stripSidecarKeys} removes them before the story goes back to the API.
 */
export const SIDECAR_PREFIX = "_";

export const isSidecarKey = (key: string): boolean => key.startsWith(SIDECAR_PREFIX);

/**
 * Removes the producer's annotations, leaving the story as the API knows it.
 *
 * Top-level keys only. `_uid` and `_editable` live *inside* `content`, where they
 * are part of the document the API itself round-trips, and removing them there
 * would corrupt the story rather than clean it.
 */
export function stripSidecarKeys(line: StoryLine): Story {
  const story: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(line)) {
    if (!isSidecarKey(key)) {
      story[key] = value;
    }
  }
  // The runtime shape is what it already was, minus keys the API never sent.
  return story as Story;
}

/** Whether the line carries the story's content, or only its list metadata. */
export const hasContent = (line: StoryLine): boolean =>
  line.content !== undefined && line.content !== null;

/** How a line is named in a message about it. */
export const describeStoryLine = (line: StoryLine): string => `#${line.id} (${line.full_slug})`;

/**
 * Validates one parsed line against the contract above.
 *
 * Checked at the boundary rather than trusted, because everything downstream of
 * it reads the line as a story: a shell script or `jq` filter in the middle of
 * the pipe can reshape a line into anything, and the failure that follows would
 * otherwise surface deep inside a write with no mention of the input.
 */
export function parseStoryLine(value: unknown, lineNumber?: number): StoryLine {
  const at = lineNumber === undefined ? "" : ` on input line ${lineNumber}`;

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CommandError(
      `Expected a story object${at}, got ${Array.isArray(value) ? "an array" : typeof value}. ` +
        "The input has to be JSONL — one complete story per line, as `storyblok stories find` writes it.",
    );
  }

  const line = value as Record<string, unknown>;
  const missing = REQUIRED_STORY_LINE_FIELDS.filter(
    (field) => line[field] === undefined || line[field] === null,
  );

  if (missing.length > 0) {
    throw new CommandError(
      `The story${at} is missing ${missing.join(", ")}. ` +
        `Every line has to carry ${REQUIRED_STORY_LINE_FIELDS.join(", ")}; ` +
        "a filter in the middle of the pipe that reshapes lines has to keep them.",
    );
  }

  // Every field the type narrows has just been checked above, and the rest of
  // the object is the story the API itself serialized.
  return line as StoryLine;
}

/**
 * The head of a consuming command's pipeline: JSONL in, validated stories out.
 *
 * What every command taking `-` mounts where it would otherwise have put a list
 * fetcher. Having one of these rather than a reader per command is what keeps
 * the format a contract instead of a convention.
 */
export function createStoryLineSource({
  input,
  onLineError,
}: {
  input?: Readable;
  onLineError?: (error: Error, lineNumber: number, raw: string) => void;
} = {}): Readable {
  return createJsonlSource<StoryLine>({ input, map: parseStoryLine, onLineError });
}

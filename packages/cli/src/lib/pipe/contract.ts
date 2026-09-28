import type { Story } from "../../types";

/**
 * The shape of one line on the wire between two CLI commands.
 *
 * A line is a **complete story as the Management API returned it**, not a
 * reference to one. A consumer takes the fields it needs off the line and
 * re-fetches only what the line does not carry. Only the producing side exists
 * so far; see ADR-0019 for the consuming one.
 *
 * Two consequences a consumer has to hold up:
 *
 * - **`content` is optional.** A producer run with `--skip-content` emits list
 *   metadata only; a consumer that needs content fetches it for the lines that
 *   lack it rather than failing the run.
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
 * having to learn each annotation: unknown sidecar keys are ignored, and removed
 * before the story goes back to the API.
 */
export const SIDECAR_PREFIX = "_";

export const isSidecarKey = (key: string): boolean => key.startsWith(SIDECAR_PREFIX);

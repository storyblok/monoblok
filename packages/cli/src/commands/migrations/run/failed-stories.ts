import { APIError } from "../../../utils/error";
import type { FailedStory } from "./constants";

/** How many failed stories the summary lists before pointing to the log file. */
export const MAX_LISTED_FAILED_STORIES = 10;

/**
 * Lists failed stories with the reason, so they can be found in the space.
 * The reason is the error message, which carries the API's own explanation
 * (e.g. a workflow stage that doesn't allow publishing) when there is one.
 * Long lists are cut off; every failed story is also in the log file.
 */
export function formatFailedStories(failed: FailedStory[]): string {
  const lines = failed.slice(0, MAX_LISTED_FAILED_STORIES).map(({ storyId, name, error }) => {
    const story = name && name !== storyId.toString() ? `${name} (id ${storyId})` : `id ${storyId}`;
    return `  - ${story}: ${error.message}`;
  });
  const unlisted = failed.length - MAX_LISTED_FAILED_STORIES;
  if (unlisted > 0) {
    lines.push(`  … and ${unlisted} more, listed in the log file.`);
  }
  return lines.join("\n");
}

/**
 * Whether an error would fail every remaining story the same way (e.g. revoked
 * credentials), so continuing the run would only repeat it for each story.
 */
export function isSystemicError(error: unknown): error is APIError {
  return (
    error instanceof APIError &&
    (error.errorId === "unauthorized" || error.errorId === "network_error")
  );
}

import { APIError } from "../../../utils/error";
import { FailureReasonGroup } from "../../../utils/failure-reason-group";

/** A story that couldn't be fetched, migrated, or updated, with the reason. */
export interface FailedStoryReport {
  storyId: number;
  name: string | undefined;
  reason: string;
}

/**
 * Lists failed stories grouped by reason, so one cause shared by hundreds of
 * stories reads as one line. The reason carries the API's own explanation
 * (e.g. a workflow stage that doesn't allow publishing) when there is one.
 */
export function listFailedStories(failed: FailedStoryReport[]): string[] {
  const group = new FailureReasonGroup();
  for (const { storyId, name, reason } of failed) {
    group.record(
      reason,
      name && name !== storyId.toString() ? `${name} (id ${storyId})` : `id ${storyId}`,
    );
  }
  return group.toListLines("migrate", ["story", "stories"]);
}

/**
 * Whether an error would fail every remaining story the same way (revoked
 * credentials), so continuing the run would only repeat it for each story.
 */
export function isSystemicError(error: unknown): error is APIError {
  return error instanceof APIError && error.errorId === "unauthorized";
}

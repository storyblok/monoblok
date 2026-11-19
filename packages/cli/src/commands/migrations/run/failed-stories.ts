import { APIError } from "../../../utils/error";
import { FailureReasonGroup } from "../../../utils/failure-reason-group";

/** A story that couldn't be fetched, migrated, or updated, as written to the report. */
export interface FailedStoryReport {
  id: number;
  name: string | undefined;
  full_slug?: string;
  step: "fetch" | "migrate" | "update";
  /** The migration file that threw, when the story failed in one. */
  migration?: string;
  error: string;
}

function toReason({ step, migration, error }: FailedStoryReport): string {
  if (step === "fetch") {
    return `Fetch failed: ${error}`;
  }
  if (step === "update") {
    return `Update failed: ${error}`;
  }
  return migration ? `${migration} failed: ${error}` : error;
}

/**
 * Lists failed stories grouped by reason, so one cause shared by hundreds of
 * stories reads as one line. The reason carries the API's own explanation
 * (e.g. a workflow stage that doesn't allow publishing) when there is one.
 */
export function listFailedStories(failed: FailedStoryReport[]): string[] {
  const group = new FailureReasonGroup();
  for (const story of failed) {
    const { id, name } = story;
    group.record(
      toReason(story),
      name && name !== id.toString() ? `${name} (id ${id})` : `id ${id}`,
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

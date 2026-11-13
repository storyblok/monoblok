import { describe, expect, it } from "vitest";
import { listFailedStories } from "./failed-stories";

const WORKFLOW_STAGE_ERROR =
  "Update failed: You are not allowed to publish at this workflow stage.";

describe("listFailedStories", () => {
  it("should name a single failed story with its reason", () => {
    expect(listFailedStories([{ storyId: 1, name: "Home", reason: WORKFLOW_STAGE_ERROR }])).toEqual(
      [`Failed to migrate "Home (id 1)": ${WORKFLOW_STAGE_ERROR}`],
    );
  });

  it("should group stories that failed for the same reason", () => {
    const failed = Array.from({ length: 300 }, (_, i) => ({
      storyId: i + 1,
      name: i === 1 ? undefined : `Story ${i + 1}`,
      reason: WORKFLOW_STAGE_ERROR,
    }));

    expect(listFailedStories(failed)).toEqual([
      `Failed to migrate 300 stories — ${WORKFLOW_STAGE_ERROR} (e.g. "Story 1 (id 1)", "id 2", "Story 3 (id 3)")`,
    ]);
  });
});

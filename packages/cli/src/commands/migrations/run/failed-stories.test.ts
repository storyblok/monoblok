import { describe, expect, it } from "vitest";
import { listFailedStories } from "./failed-stories";

const WORKFLOW_STAGE_ERROR = "You are not allowed to publish at this workflow stage.";

describe("listFailedStories", () => {
  it("should name a single failed story with its reason", () => {
    expect(
      listFailedStories([{ id: 1, name: "Home", step: "update", error: WORKFLOW_STAGE_ERROR }]),
    ).toEqual([`Failed to migrate "Home (id 1)": Update failed: ${WORKFLOW_STAGE_ERROR}`]);
  });

  it("should name the step a story failed in", () => {
    expect(
      listFailedStories([
        { id: 1, name: "Home", step: "fetch", error: "Not found" },
        { id: 2, name: "About", step: "migrate", migration: "page.js", error: "boom" },
        { id: 3, name: "Contact", step: "migrate", error: "Story content is missing" },
      ]),
    ).toEqual([
      'Failed to migrate "Home (id 1)": Fetch failed: Not found',
      'Failed to migrate "About (id 2)": page.js failed: boom',
      'Failed to migrate "Contact (id 3)": Story content is missing',
    ]);
  });

  it("should group stories that failed for the same reason", () => {
    const failed = Array.from({ length: 300 }, (_, i) => ({
      id: i + 1,
      name: i === 1 ? undefined : `Story ${i + 1}`,
      step: "update" as const,
      error: WORKFLOW_STAGE_ERROR,
    }));

    expect(listFailedStories(failed)).toEqual([
      `Failed to migrate 300 stories — Update failed: ${WORKFLOW_STAGE_ERROR} (e.g. "Story 1 (id 1)", "id 2", "Story 3 (id 3)")`,
    ]);
  });
});

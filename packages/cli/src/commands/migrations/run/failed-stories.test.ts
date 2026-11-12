import { describe, expect, it } from "vitest";
import { formatFailedStories, MAX_LISTED_FAILED_STORIES } from "./failed-stories";
import type { FailedStory } from "./constants";

const failedStory = (storyId: number): FailedStory => ({
  storyId,
  name: `Story ${storyId}`,
  error: new Error("You are not allowed to publish at this workflow stage."),
});

describe("formatFailedStories", () => {
  it("should list each failed story with its reason", () => {
    expect(formatFailedStories([failedStory(1), { ...failedStory(2), name: undefined }])).toBe(
      [
        "  - Story 1 (id 1): You are not allowed to publish at this workflow stage.",
        "  - id 2: You are not allowed to publish at this workflow stage.",
      ].join("\n"),
    );
  });

  it("should point to the log file instead of listing every story of a long list", () => {
    const failed = Array.from({ length: MAX_LISTED_FAILED_STORIES + 290 }, (_, i) =>
      failedStory(i + 1),
    );

    const lines = formatFailedStories(failed).split("\n");

    expect(lines).toHaveLength(MAX_LISTED_FAILED_STORIES + 1);
    expect(lines.at(-1)).toBe("  … and 290 more, listed in the log file.");
  });
});

import { describe, expect, it } from "vitest";
import { matchesPublishStatus, publishStatusToQueryParams } from "./filters";
import type { PublishStatus } from "./filters";
import type { Story } from "../constants";

/**
 * Only the two list fields the status is decided from. Everything else on a
 * story is irrelevant here, and spelling it out would hide which two matter.
 */
const listed = (published?: boolean, unpublishedChanges?: boolean): Story =>
  ({ published, unpublished_changes: unpublishedChanges }) as unknown as Story;

describe("publishStatusToQueryParams", () => {
  // `published` and `published-with-changes` share a server filter and are told
  // apart client-side.
  it("should narrow to published stories for published and published-with-changes", () => {
    expect(publishStatusToQueryParams(["published"])).toEqual({ is_published: true });
    expect(publishStatusToQueryParams(["published", "published-with-changes"])).toEqual({
      is_published: true,
    });
  });

  it("should narrow to unpublished stories for draft", () => {
    expect(publishStatusToQueryParams(["draft"])).toEqual({ is_published: false });
  });

  it("should not narrow when the statuses disagree on is_published", () => {
    expect(publishStatusToQueryParams(["published-with-changes", "draft"])).toEqual({});
  });
});

describe("matchesPublishStatus", () => {
  describe("published", () => {
    it("should match a story that is live with no pending edits", () => {
      expect(matchesPublishStatus(listed(true, false), "published")).toBe(true);
    });

    it("should reject a story with unpublished changes", () => {
      expect(matchesPublishStatus(listed(true, true), "published")).toBe(false);
    });

    it("should reject a story that was never published", () => {
      expect(matchesPublishStatus(listed(false, false), "published")).toBe(false);
    });
  });

  describe("published-with-changes", () => {
    it("should match a published story carrying unpublished edits", () => {
      expect(matchesPublishStatus(listed(true, true), "published-with-changes")).toBe(true);
    });

    it("should reject a story that is live and unedited", () => {
      expect(matchesPublishStatus(listed(true, false), "published-with-changes")).toBe(false);
    });

    it("should reject an unpublished story, edited or not", () => {
      expect(matchesPublishStatus(listed(false, true), "published-with-changes")).toBe(false);
    });
  });

  describe("draft", () => {
    it("should match a story that is not live, edited or not", () => {
      expect(matchesPublishStatus(listed(false, false), "draft")).toBe(true);
      expect(matchesPublishStatus(listed(false, true), "draft")).toBe(true);
    });

    // Combined with another status, the server cannot narrow, so this stage decides.
    it("should reject a live story", () => {
      expect(matchesPublishStatus(listed(true, false), "draft")).toBe(false);
      expect(matchesPublishStatus(listed(true, true), "draft")).toBe(false);
    });

    // Publishing a folder publishes it too, so an unpublished one is a draft like any story.
    it("should match an unpublished folder", () => {
      const folder = { ...listed(false, false), is_folder: true } as Story;
      expect(matchesPublishStatus(folder, "draft")).toBe(true);
    });
  });

  // The helpers behind this return `undefined` rather than `false` when a field
  // is absent, so the status check has to coerce. Without that, a missing field
  // would make the filter return a non-boolean and quietly pass the story.
  describe("a listing missing the fields", () => {
    it.each<PublishStatus>(["published", "published-with-changes", "draft"])(
      "should reject rather than pass a story with no publish metadata for %s",
      (status) => {
        expect(matchesPublishStatus(listed(undefined, undefined), status)).toBe(false);
      },
    );
  });
});

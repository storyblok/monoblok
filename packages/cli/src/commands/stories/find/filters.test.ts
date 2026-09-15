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
  // `published` and `changed` share a server filter and are told apart
  // client-side; `draft` is settled entirely by the server.
  it("should narrow to published stories for both published and changed", () => {
    expect(publishStatusToQueryParams("published")).toEqual({ is_published: true });
    expect(publishStatusToQueryParams("changed")).toEqual({ is_published: true });
  });

  it("should narrow to unpublished stories for draft", () => {
    expect(publishStatusToQueryParams("draft")).toEqual({ is_published: false });
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

  describe("changed", () => {
    it("should match a published story carrying unpublished edits", () => {
      expect(matchesPublishStatus(listed(true, true), "changed")).toBe(true);
    });

    it("should reject a story that is live and unedited", () => {
      expect(matchesPublishStatus(listed(true, false), "changed")).toBe(false);
    });

    it("should reject an unpublished story, edited or not", () => {
      expect(matchesPublishStatus(listed(false, true), "changed")).toBe(false);
    });
  });

  describe("draft", () => {
    // The server already returned only unpublished stories, so this stage has
    // nothing left to decide and must not drop any of them.
    it("should pass every story through, since the server already narrowed", () => {
      expect(matchesPublishStatus(listed(false, false), "draft")).toBe(true);
      expect(matchesPublishStatus(listed(true, true), "draft")).toBe(true);
    });
  });

  // The helpers behind this return `undefined` rather than `false` when a field
  // is absent, so the status check has to coerce. Without that, a missing field
  // would make the filter return a non-boolean and quietly pass the story.
  describe("a listing missing the fields", () => {
    it.each<PublishStatus>(["published", "changed"])(
      "should reject rather than pass a story with no publish metadata for %s",
      (status) => {
        expect(matchesPublishStatus(listed(undefined, undefined), status)).toBe(false);
      },
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finished } from "node:stream/promises";
import { ClientError } from "@storyblok/management-api-client";
import { UpdateStream } from "./update-stream";
import { updateStory } from "../../../stories/actions";
import { APIError, handleAPIError } from "../../../../utils/error";
import { FetchError } from "../../../../utils/fetch";
import { resetLogger, setLoggerTransports } from "../../../../lib/logger/logger";
import type { BlokContent } from "../../../stories/constants";
import type { Story } from "../../../stories/constants";

// Mock the updateStory action
vi.mock("../../../stories/actions", () => ({
  updateStory: vi.fn(),
}));

const mockContent: BlokContent = {
  _uid: "test-uid",
  component: "page",
  title: "Test Content",
};
const mockUpdatedStory: Story = {
  id: 1,
  name: "Test Story",
  uuid: "uuid-1",
  slug: "test-story",
  full_slug: "test-story",
  content: mockContent,
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
  published_at: "2023-01-01T00:00:00Z",
  first_published_at: "2023-01-01T00:00:00Z",
  published: true,
  unpublished_changes: false,
  is_startpage: false,
  is_folder: false,
  pinned: false,
  parent_id: 0,
  group_id: "group-1",
  parent: null,
  path: null,
  position: 0,
  sort_by_date: null,
  tag_list: [],
  disble_fe_editor: false,
  disable_fe_editor: false,
  default_root: null,
  preview_token: {
    token: "preview-token",
    timestamp: "2023-01-01T00:00:00Z",
  },
  meta_data: null,
  last_author: null,
  last_author_id: null,
  alternates: [],
  translated_slugs: [],
  localized_paths: [],
  breadcrumbs: [],
  publish_at: null,
  expire_at: null,
  user_ids: [],
  space_role_ids: [],
  translated_stories: [],
  can_not_view: null,
  is_scheduled: null,
  scheduled_dates: null,
  ideas: [],
  favourite_for_user_ids: [],
  imported_at: null,
  deleted_at: null,
};

describe("updateStream", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe("publish flag behavior", () => {
    it('should publish stories with "published" flag only if they were already published without changes', async () => {
      const updateStream = new UpdateStream({
        space: "12345",
        publish: "published",
        dryRun: false,
      });

      vi.mocked(updateStory).mockResolvedValue(mockUpdatedStory);

      return new Promise<void>((resolve) => {
        updateStream.on("finish", () => {
          // Check that updateStory was called with publish=1 for published story without changes
          expect(updateStory).toHaveBeenCalledWith("12345", 1, {
            story: {
              content: mockContent,
              name: "Published Story",
            },
            force_update: "1",
            publish: 1,
          });

          // Check that updateStory was called without publish for unpublished story
          expect(updateStory).toHaveBeenCalledWith("12345", 2, {
            story: {
              content: mockContent,
              name: "Unpublished Story",
            },
            force_update: "1",
          });

          // Check that updateStory was called without publish for published story with changes
          expect(updateStory).toHaveBeenCalledWith("12345", 3, {
            story: {
              content: mockContent,
              name: "Published Story with Changes",
            },
            force_update: "1",
          });

          resolve();
        });

        // Test case 1: Published story without changes - should be published
        updateStream.write({
          storyId: 1,
          name: "Published Story",
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        // Test case 2: Unpublished story - should NOT be published
        updateStream.write({
          storyId: 2,
          name: "Unpublished Story",
          content: mockContent,
          published: false,
          unpublished_changes: false,
        });

        // Test case 3: Published story with changes - should NOT be published
        updateStream.write({
          storyId: 3,
          name: "Published Story with Changes",
          content: mockContent,
          published: true,
          unpublished_changes: true,
        });

        updateStream.end();
      });
    });

    it('should publish stories with "published-with-changes" flag only if they have unpublished changes', async () => {
      const updateStream = new UpdateStream({
        space: "12345",
        publish: "published-with-changes",
        dryRun: false,
      });

      vi.mocked(updateStory).mockResolvedValue(mockUpdatedStory);

      return new Promise<void>((resolve) => {
        updateStream.on("finish", () => {
          // Check that updateStory was called without publish for published story without changes
          expect(updateStory).toHaveBeenCalledWith("12345", 1, {
            story: {
              content: mockContent,
              name: "Published Story",
            },
            force_update: "1",
          });

          // Check that updateStory was called without publish for unpublished story
          expect(updateStory).toHaveBeenCalledWith("12345", 2, {
            story: {
              content: mockContent,
              name: "Unpublished Story",
            },
            force_update: "1",
          });

          // Check that updateStory was called with publish=1 for published story with changes
          expect(updateStory).toHaveBeenCalledWith("12345", 3, {
            story: {
              content: mockContent,
              name: "Published Story with Changes",
            },
            force_update: "1",
            publish: 1,
          });

          resolve();
        });

        // Test case 1: Published story without changes - should NOT be published
        updateStream.write({
          storyId: 1,
          name: "Published Story",
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        // Test case 2: Unpublished story - should NOT be published
        updateStream.write({
          storyId: 2,
          name: "Unpublished Story",
          content: mockContent,
          published: false,
          unpublished_changes: false,
        });

        // Test case 3: Published story with changes - should be published
        updateStream.write({
          storyId: 3,
          name: "Published Story with Changes",
          content: mockContent,
          published: true,
          unpublished_changes: true,
        });

        updateStream.end();
      });
    });

    it('should publish all stories with "all" flag regardless of their status', async () => {
      const updateStream = new UpdateStream({
        space: "12345",
        publish: "all",
        dryRun: false,
      });

      vi.mocked(updateStory).mockResolvedValue(mockUpdatedStory);

      return new Promise<void>((resolve) => {
        updateStream.on("finish", () => {
          // Check that all updateStory calls included publish=1
          expect(updateStory).toHaveBeenCalledWith("12345", 1, {
            story: {
              content: mockContent,
              name: "Published Story",
            },
            force_update: "1",
            publish: 1,
          });

          expect(updateStory).toHaveBeenCalledWith("12345", 2, {
            story: {
              content: mockContent,
              name: "Unpublished Story",
            },
            force_update: "1",
            publish: 1,
          });

          expect(updateStory).toHaveBeenCalledWith("12345", 3, {
            story: {
              content: mockContent,
              name: "Published Story with Changes",
            },
            force_update: "1",
            publish: 1,
          });

          resolve();
        });

        // All stories should be published regardless of their status
        updateStream.write({
          storyId: 1,
          name: "Published Story",
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        updateStream.write({
          storyId: 2,
          name: "Unpublished Story",
          content: mockContent,
          published: false,
          unpublished_changes: false,
        });

        updateStream.write({
          storyId: 3,
          name: "Published Story with Changes",
          content: mockContent,
          published: true,
          unpublished_changes: true,
        });

        updateStream.end();
      });
    });

    it("should not publish any stories when no publish flag is provided", async () => {
      const updateStream = new UpdateStream({
        space: "12345",
        dryRun: false,
      });

      vi.mocked(updateStory).mockResolvedValue(mockUpdatedStory);

      return new Promise<void>((resolve) => {
        updateStream.on("finish", () => {
          // Check that no updateStory calls included publish=1
          expect(updateStory).toHaveBeenCalledWith("12345", 1, {
            story: {
              content: mockContent,
              name: "Test Story",
            },
            force_update: "1",
          });

          resolve();
        });

        updateStream.write({
          storyId: 1,
          name: "Test Story",
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        updateStream.end();
      });
    });
  });
  describe("failing stories", () => {
    const content: BlokContent = { _uid: "uid", component: "page" };
    const WORKFLOW_STAGE_ERROR =
      "You are not allowed to publish at this workflow stage. Please change the workflow stage first.";

    const rejectsWithWorkflowStageError = () => {
      try {
        handleAPIError(
          "update_story",
          new ClientError("Unprocessable Entity", {
            status: 422,
            statusText: "Unprocessable Entity",
            data: { error: WORKFLOW_STAGE_ERROR },
          }),
        );
      } catch (error) {
        return Promise.reject(error);
      }
      return Promise.reject(new Error("Expected handleAPIError to throw"));
    };

    const writeStories = async (updateStream: UpdateStream) => {
      updateStream.write({ storyId: 1, name: "Home", content });
      updateStream.write({ storyId: 2, name: "About", content });
      updateStream.write({ storyId: 3, name: "Contact", content });
      updateStream.end();
      await finished(updateStream);
    };

    afterEach(() => {
      resetLogger();
    });

    it("should keep updating the other stories when one story fails", async () => {
      vi.mocked(updateStory).mockImplementation((_space, storyId) =>
        storyId === 2
          ? rejectsWithWorkflowStageError()
          : Promise.resolve({ ...mockUpdatedStory, id: storyId }),
      );
      const updateStream = new UpdateStream({ space: "12345", publish: "all" });

      await writeStories(updateStream);

      const results = updateStream.getResults();
      expect(results.successful.map((story) => story.storyId)).toEqual([1, 3]);
      expect(results.failed).toEqual([{ storyId: 2, name: "About", error: expect.any(Error) }]);
      expect(results.failed[0]?.error.message).toBe(WORKFLOW_STAGE_ERROR);
    });

    it("should report each failed story with the reason", async () => {
      vi.mocked(updateStory).mockImplementation((_space, storyId) =>
        storyId === 2
          ? rejectsWithWorkflowStageError()
          : Promise.resolve({ ...mockUpdatedStory, id: storyId }),
      );
      const onError = vi.fn();
      const updateStream = new UpdateStream({ space: "12345", publish: "all", onError });

      await writeStories(updateStream);

      expect(updateStream.getSummary()).toBe(
        "Update Results: 2 stories updated, 1 stories failed.",
      );
      expect(onError).toHaveBeenCalledExactlyOnceWith({
        storyId: 2,
        name: "About",
        error: expect.objectContaining({ message: WORKFLOW_STAGE_ERROR }),
      });
    });

    it("should finish the run when every log transport throws", async () => {
      const unhandledRejection = vi.fn();
      process.on("unhandledRejection", unhandledRejection);
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      setLoggerTransports([
        {
          log: () => {
            throw new Error("disk full");
          },
        },
      ]);
      vi.mocked(updateStory).mockImplementation((_space, storyId) =>
        storyId === 2
          ? rejectsWithWorkflowStageError()
          : Promise.resolve({ ...mockUpdatedStory, id: storyId }),
      );
      const updateStream = new UpdateStream({ space: "12345", publish: "all" });

      try {
        await writeStories(updateStream);
        await new Promise((resolve) => setImmediate(resolve));

        expect(unhandledRejection).not.toHaveBeenCalled();
        const results = updateStream.getResults();
        expect(results.successful.map((story) => story.storyId)).toEqual([1, 3]);
        expect(results.failed.map((story) => story.storyId)).toEqual([2]);
      } finally {
        process.off("unhandledRejection", unhandledRejection);
        stderrSpy.mockRestore();
      }
    });

    it("should record a story whose update failed unexpectedly", async () => {
      const updateStream = new UpdateStream({ space: "12345", publish: "all" });
      // @ts-expect-error Simulates a failure `updateStory` doesn't handle itself.
      vi.spyOn(updateStream, "updateStory").mockRejectedValue(new Error("Unexpected failure"));

      await writeStories(updateStream);
      await new Promise((resolve) => setImmediate(resolve));

      const results = updateStream.getResults();
      expect(results.failed).toEqual([
        { storyId: 1, name: "Home", error: new Error("Unexpected failure") },
        { storyId: 2, name: "About", error: new Error("Unexpected failure") },
        { storyId: 3, name: "Contact", error: new Error("Unexpected failure") },
      ]);
      expect(results.totalProcessed).toBe(3);
    });

    it("should stop updating stories when the API rejects the credentials", async () => {
      vi.mocked(updateStory).mockRejectedValue(
        new APIError(
          "unauthorized",
          "update_story",
          new FetchError("Unauthorized", { status: 401, statusText: "Unauthorized" }),
        ),
      );
      const updateStream = new UpdateStream({ space: "12345", publish: "all" });
      const onError = vi.fn();
      updateStream.on("error", onError);

      updateStream.write({ storyId: 1, name: "Home", content });
      await new Promise((resolve) => setImmediate(resolve));
      updateStream.write({ storyId: 2, name: "About", content });
      await new Promise((resolve) => setImmediate(resolve));

      expect(updateStory).toHaveBeenCalledTimes(1);
      expect(updateStream.destroyed).toBe(true);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ errorId: "unauthorized" }));
      expect(updateStream.getResults().failed).toEqual([
        { storyId: 1, name: "Home", error: expect.objectContaining({ errorId: "unauthorized" }) },
      ]);
    });

    it("should not start an update that waited for a slot when the credentials were rejected", async () => {
      const pending: Array<{ resolve: (story: Story) => void; reject: (error: unknown) => void }> =
        [];
      vi.mocked(updateStory).mockImplementation(
        () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
      );
      const updateStream = new UpdateStream({ space: "12345", publish: "all" });
      updateStream.on("error", () => {});
      const tick = () => new Promise((resolve) => setImmediate(resolve));

      // One more story than there are slots, so the last one waits.
      for (let storyId = 1; storyId <= 13; storyId++) {
        updateStream.write({ storyId, name: `Story ${storyId}`, content });
      }
      await tick();
      expect(updateStory).toHaveBeenCalledTimes(12);

      pending[0]?.reject(
        new APIError(
          "unauthorized",
          "update_story",
          new FetchError("Unauthorized", { status: 401, statusText: "Unauthorized" }),
        ),
      );
      await tick();
      for (const { resolve } of pending.slice(1)) {
        resolve(mockUpdatedStory);
      }
      await tick();

      expect(updateStory).toHaveBeenCalledTimes(12);
    });
  });
});

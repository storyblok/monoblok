import type { Story } from "../constants";
import { isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from "../utils";

export type PublishStatus = "published" | "changed" | "draft";

/**
 * `published` and `changed` share `is_published` and are told apart by
 * `unpublished_changes`. `draft` excludes folders, which are never published.
 */
export function matchesPublishStatus(story: Story, status: PublishStatus): boolean {
  switch (status) {
    case "published":
      return isStoryPublishedWithoutChanges(story) === true;
    case "changed":
      return isStoryWithUnpublishedChanges(story) === true;
    case "draft":
      return story.is_folder !== true;
  }
}

export function publishStatusToQueryParams(status: PublishStatus): { is_published?: boolean } {
  switch (status) {
    case "published":
    case "changed":
      return { is_published: true };
    case "draft":
      return { is_published: false };
  }
}

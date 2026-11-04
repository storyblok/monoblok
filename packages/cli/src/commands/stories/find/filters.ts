import type { Story } from "../constants";
import { isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from "../utils";

/** Named like `migrations run --publish`, so the same state reads the same across commands. */
export const PUBLISH_STATUSES = ["published", "published-with-changes", "draft"] as const;

export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

/**
 * `published` and `published-with-changes` share `is_published` and are told
 * apart by `unpublished_changes`. `draft` is anything not live, folders
 * included: never published, or unpublished since.
 */
export function matchesPublishStatus(story: Story, status: PublishStatus): boolean {
  switch (status) {
    case "published":
      return isStoryPublishedWithoutChanges(story) === true;
    case "published-with-changes":
      return isStoryWithUnpublishedChanges(story) === true;
    case "draft":
      return story.published === false;
  }
}

/**
 * The server half of a set of statuses. It can only narrow to `is_published`,
 * so it narrows only when every status asked for agrees on it.
 */
export function publishStatusToQueryParams(statuses: PublishStatus[]): {
  is_published?: boolean;
} {
  const published = new Set(statuses.map((status) => status !== "draft"));
  return published.size === 1 ? { is_published: [...published][0] } : {};
}

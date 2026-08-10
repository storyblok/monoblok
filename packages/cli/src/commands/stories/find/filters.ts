import type { Story } from '../constants';
import { isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from '../utils';

export type PublishStatus = 'published' | 'changed' | 'draft';

/**
 * Filters a story by publish status (client-side).
 *
 * Server-side narrowing (is_published) is applied at the query level.
 * This filter handles the client-side distinction:
 * - `published`: is_published=true + unpublished_changes === false
 * - `changed`: is_published=true + unpublished_changes === true
 * - `draft`: fully server-side, no client filter needed
 */
export function matchesPublishStatus(story: Story, status: PublishStatus): boolean {
  switch (status) {
    case 'published':
      return isStoryPublishedWithoutChanges(story) === true;
    case 'changed':
      return isStoryWithUnpublishedChanges(story) === true;
    case 'draft':
      return true; // fully server-side filtered
  }
}

/**
 * Returns the MAPI query params for server-side publish status filtering.
 */
export function publishStatusToQueryParams(status: PublishStatus): { is_published?: boolean } {
  switch (status) {
    case 'published':
    case 'changed':
      return { is_published: true };
    case 'draft':
      return { is_published: false };
  }
}

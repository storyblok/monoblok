import type { Story } from './constants';

/**
 * @method isStoryPublishedWithoutChanges
 * @param  {object} story
 * @return {boolean}
 */
export const isStoryPublishedWithoutChanges = (story: Partial<Story>) => {
  return story.published && !story.unpublished_changes;
};

/**
 * @method isStoryWithUnpublishedChanges
 * @param  {object} story
 * @return {boolean}
 */
export const isStoryWithUnpublishedChanges = (story: Partial<Story>) => {
  return story.published && story.unpublished_changes;
};

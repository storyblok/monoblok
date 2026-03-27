import type { Tag } from '../types/tag';

const TAG_DEFAULTS = {
  taggings_count: 0,
};

type TagInput = { name: string } & Partial<Omit<Tag, 'name'>>;

/**
 * Defines a tag object with type safety.
 * API-assigned fields (`taggings_count`) are optional and filled with safe defaults.
 *
 * @example
 * const tag = defineTag({ name: 'featured' });
 */
export const defineTag = (tag: TagInput): Tag => ({
  ...TAG_DEFAULTS,
  ...tag,
});

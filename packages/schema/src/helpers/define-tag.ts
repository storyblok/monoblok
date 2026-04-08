import type { Tag } from '../generated/types';
import type { Prettify } from '../utils/prettify';

const TAG_DEFAULTS = {
  taggings_count: 0,
};

export type { Tag };

/** Fields that have safe defaults and may be omitted from tag input. */
type TagOptional = keyof typeof TAG_DEFAULTS;

type TagInput = Prettify<Omit<Tag, TagOptional> & Partial<Pick<Tag, TagOptional>>>;

/**
 * Returns a full {@link Tag} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const tag = defineTag({
 *   name: 'featured',
 * });
 */
// Overload: provides the strict public signature for callers.
export function defineTag(tag: TagInput): Tag;

// Implementation signature: uses a loose parameter type because
// TypeScript requires the implementation signature to be assignable
// to all overloads. Not visible to callers.
export function defineTag(tag: any) {
  return { ...TAG_DEFAULTS, ...tag };
}

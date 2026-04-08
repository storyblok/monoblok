import type { InternalTag, InternalTagCreate, InternalTagUpdate } from '../../generated/mapi-types';

export type { InternalTag, InternalTagCreate, InternalTagUpdate };

const INTERNAL_TAG_DEFAULTS = {
  id: 1,
};

type InternalTagInput = { name: string } & Partial<Omit<InternalTag, 'name'>>;

/**
 * Defines an internal tag for the MAPI.
 * API-assigned fields (`id`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineInternalTag } from '@storyblok/schema/mapi';
 * const tag = defineInternalTag({ name: 'hero' });
 */
export const defineInternalTag = (internalTag: InternalTagInput): InternalTag => ({
  ...INTERNAL_TAG_DEFAULTS,
  ...internalTag,
});

/**
 * Defines an internal tag creation payload for the MAPI.
 *
 * @example
 * import { defineInternalTagCreate } from '@storyblok/schema/mapi';
 * const payload = defineInternalTagCreate({ name: 'hero', object_type: 'asset' });
 */
export const defineInternalTagCreate = (internalTag: InternalTagCreate): InternalTagCreate => internalTag;

/**
 * Defines an internal tag update payload for the MAPI.
 *
 * @example
 * import { defineInternalTagUpdate } from '@storyblok/schema/mapi';
 * const payload = defineInternalTagUpdate({ name: 'hero-image' });
 */
export const defineInternalTagUpdate = (internalTag: InternalTagUpdate): InternalTagUpdate => internalTag;

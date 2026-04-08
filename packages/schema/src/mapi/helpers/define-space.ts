import type { Space, SpaceCreate, SpaceUpdate } from '../../generated/mapi-types';

export type { Space, SpaceCreate, SpaceUpdate };

const SPACE_DEFAULTS = {
  id: 1,
};

type SpaceInput = { name: string } & Partial<Omit<Space, 'name'>>;

/**
 * Defines a space for the MAPI.
 * `name` is required; API-assigned fields (`id`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineSpace } from '@storyblok/schema/mapi';
 * const space = defineSpace({ name: 'My Space' });
 */
export const defineSpace = (space: SpaceInput): Space => ({ ...SPACE_DEFAULTS, ...space });

/**
 * Defines a space creation payload for the MAPI.
 *
 * @example
 * import { defineSpaceCreate } from '@storyblok/schema/mapi';
 * const payload = defineSpaceCreate({ name: 'My New Space' });
 */
export const defineSpaceCreate = (space: SpaceCreate): SpaceCreate => space;

/**
 * Defines a space update payload for the MAPI.
 *
 * @example
 * import { defineSpaceUpdate } from '@storyblok/schema/mapi';
 * const payload = defineSpaceUpdate({ name: 'Updated Space Name' });
 */
export const defineSpaceUpdate = (space: SpaceUpdate): SpaceUpdate => space;

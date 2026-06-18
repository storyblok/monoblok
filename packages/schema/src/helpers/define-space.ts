import type { Space, SpaceCreate, SpaceUpdate } from '../generated/mapi/types.gen';

export type { Space, SpaceCreate, SpaceUpdate };

const SPACE_DEFAULTS = {
  id: 1,
  region: '',
  owner_id: 1,
  updated_at: '',
  created_at: '',
  plan: '',
  plan_level: 0,
  trial: false,
  requires_2fa: false,
  org_requires_2fa: false,
  development_mode: false,
  feature_limit_exceeded_flags: {},
};

type SpaceInput = { name: string } & Partial<Omit<Space, 'name'>>;

/**
 * Defines a space for the MAPI.
 * `name` is required; API-assigned fields (`id`) default to safe values.
 *
 * @example
 * const space = defineSpace({ name: 'My Space' });
 */
export const defineSpace = (space: SpaceInput): Space => ({ ...SPACE_DEFAULTS, ...space });

/**
 * Defines a space creation payload for the MAPI.
 *
 * @example
 * const payload = defineSpaceCreate({ name: 'My New Space' });
 */
export const defineSpaceCreate = (space: SpaceCreate): SpaceCreate => space;

/**
 * Defines a space update payload for the MAPI.
 *
 * @example
 * const payload = defineSpaceUpdate({ name: 'Updated Space Name' });
 */
export const defineSpaceUpdate = (space: SpaceUpdate): SpaceUpdate => space;

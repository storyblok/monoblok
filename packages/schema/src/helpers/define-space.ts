import type { Space } from '../generated/types';
import type { Prettify } from '../utils/prettify';

const SPACE_DEFAULTS = {
  id: 1,
  version: 1,
  language_codes: [],
};

export type { Space };

/** Fields that have safe defaults and may be omitted from space input. */
type SpaceOptional = keyof typeof SPACE_DEFAULTS;

type SpaceInput = Prettify<Omit<Space, SpaceOptional> & Partial<Pick<Space, SpaceOptional>>>;

/**
 * Returns a full {@link Space} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const space = defineSpace({
 *   name: 'My Space',
 *   domain: 'example.com',
 * });
 */
// Overload: provides the strict public signature for callers.
export function defineSpace(space: SpaceInput): Space;

// Implementation signature: uses a loose parameter type because
// TypeScript requires the implementation signature to be assignable
// to all overloads. Not visible to callers.
export function defineSpace(space: any) {
  return { ...SPACE_DEFAULTS, ...space };
}

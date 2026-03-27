import type { Space } from '../types/space';

const SPACE_DEFAULTS = {
  id: 1,
  version: 1,
  language_codes: [],
};

type SpaceInput = { name: string; domain: string } & Partial<Omit<Space, 'name' | 'domain'>>;

/**
 * Defines a space object with type safety.
 * API-assigned fields (`id`, `version`) are optional and filled with safe defaults.
 *
 * @example
 * const space = defineSpace({ name: 'My Space', domain: 'example.com' });
 */
export const defineSpace = (space: SpaceInput): Space => ({
  ...SPACE_DEFAULTS,
  ...space,
});

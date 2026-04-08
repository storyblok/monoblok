import type { Link } from '../generated/types';
import type { Prettify } from '../utils/prettify';

const LINK_DEFAULTS = {
  id: 1,
  uuid: '',
  path: null,
  real_path: '',
  is_folder: false,
  published: false,
  is_startpage: false,
  position: 0,
};

export type { Link };

/** Fields that have safe defaults and may be omitted from link input. */
type LinkOptional = keyof typeof LINK_DEFAULTS;

type LinkInput = Prettify<Omit<Link, LinkOptional> & Partial<Pick<Link, LinkOptional>>>;

/**
 * Returns a full {@link Link} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const link = defineLink({
 *   name: 'Home',
 *   slug: 'home',
 * });
 */
// Overload: provides the strict public signature for callers.
export function defineLink(link: LinkInput): Link;

// Implementation signature: uses a loose parameter type because
// TypeScript requires the implementation signature to be assignable
// to all overloads. Not visible to callers.
export function defineLink(link: any) {
  return { ...LINK_DEFAULTS, ...link };
}

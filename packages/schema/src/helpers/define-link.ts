import type { Link } from '../types/link';

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

type LinkInput = { name: string; slug: string } & Partial<Omit<Link, 'name' | 'slug'>>;

/**
 * Defines a link object with type safety.
 * API-assigned fields (`id`, `uuid`, `position`, etc.) are optional and filled with safe defaults.
 *
 * @example
 * const link = defineLink({ name: 'Home', slug: 'home' });
 */
export const defineLink = (link: LinkInput): Link => ({
  ...LINK_DEFAULTS,
  ...link,
});

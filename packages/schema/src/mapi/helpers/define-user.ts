import type { User, UserUpdate } from '../types/user';

const USER_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
};

type UserInput = { email: string } & Partial<Omit<User, 'email'>>;

/**
 * Defines a user object for the MAPI.
 * API-assigned fields (`id`, `created_at`, `updated_at`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineUser } from '@storyblok/schema/mapi';
 * const user = defineUser({ email: 'dev@example.com' });
 */
export const defineUser = (user: UserInput): User => ({
  ...USER_DEFAULTS,
  ...user,
});

/**
 * Defines a user update payload for the MAPI (updateMe endpoint).
 *
 * @example
 * import { defineUserUpdate } from '@storyblok/schema/mapi';
 * const payload = defineUserUpdate({ firstname: 'Jane', lastname: 'Doe' });
 */
export const defineUserUpdate = (user: UserUpdate): UserUpdate => user;

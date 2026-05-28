import type { User, UserUpdate } from '../generated/mapi/types.gen';

export type { User, UserUpdate };

const USER_DEFAULTS = {
  id: 1,
  userid: '',
  created_at: '',
  use_username: false,
  login_strategy: 'password' as const,
  has_org: false,
  has_partner: false,
  org: {},
  friendly_name: '',
  notified: [],
  favourite_spaces: [],
  favourite_ideas: [],
  beta_user: false,
  track_statistics: true,
  ui_theme: {},
  totp_factor_verified: false,
  configured_2fa_options: [],
  disclaimer_ids: [],
  live_chat_enabled: false,
  confirmed: false,
};

type UserInput = { email: string } & Partial<Omit<User, 'email'>>;

/**
 * Defines a user object for the MAPI.
 * API-assigned fields (`id`, `created_at`, `updated_at`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineUser } from '@storyblok/schema';
 * const user = defineUser({ email: 'dev@example.com' });
 */
export const defineUser = (user: UserInput): User => ({
  ...USER_DEFAULTS,
  ...user,
  userid: user.userid ?? USER_DEFAULTS.userid,
});

/**
 * Defines a user update payload for the MAPI (updateMe endpoint).
 *
 * @example
 * import { defineUserUpdate } from '@storyblok/schema';
 * const payload = defineUserUpdate({ firstname: 'Jane', lastname: 'Doe' });
 */
export const defineUserUpdate = (user: UserUpdate): UserUpdate => user;

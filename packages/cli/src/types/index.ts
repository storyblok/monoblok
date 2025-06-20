import type { RegionCode } from '../constants';

/**
 * Interface representing the default options for a CLI command.
 */
export interface CommandOptions {
  /**
   * Indicates whether verbose output is enabled.
   */
  verbose: boolean;
}

// All these types should come from a general package

/**
 * Interface representing a language in Storyblok
 */
export interface Language {
  name: string;
  code: string;
  fallback_code?: string;
  ai_translation_code: string | null;
}

export interface SpaceInternationalization {
  languages: Language[];
  default_lang_name: string;
}

export interface StoryblokUser {
  id: number;
  email: string;
  username: string;
  friendly_name: string;
  otp_required: boolean;
  access_token: string;
}

export interface StoryblokLoginResponse {
  otp_required: boolean;
  login_strategy: string;
  configured_2fa_options: string[];
  access_token?: string;
}

export interface StoryblokLoginWithOtpResponse {
  access_token: string;
  email: string;
  token_type: string;
  user_id: number;
  role: string;
  has_partner: boolean;
}

export interface FileReaderResult<T> {
  data: T[];
  error?: Error;
}

export interface StoryblokCredentials {
  login: string;
  password: string;
  region: RegionCode;
}

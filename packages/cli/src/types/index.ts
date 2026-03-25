import type { RegionCode } from '../constants';
import type { Space } from '@storyblok/management-api-client';

export type {
  Asset,
  AssetCreate,
  AssetFolder,
  AssetFolderCreate,
  AssetFolderUpdate,
  AssetListQuery,
  AssetUpdate,
  Component,
  ComponentCreate,
  ComponentFolder,
  ComponentSchemaField,
  ComponentUpdate,
  Datasource,
  DatasourceCreate,
  DatasourceEntry,
  DatasourceUpdate,
  InternalTag,
  Preset,
  Space,
  SpaceCreate,
  SpaceUpdate,
  Story,
  StoryContent,
  StoryCreate,
  StoryListQuery,
  StoryUpdate,
  User,
} from '@storyblok/management-api-client';

/**
 * Interface representing the default options for a CLI command.
 */
export interface CommandOptions {
  /**
   * Indicates whether verbose output is enabled.
   */
  verbose: boolean;
}

/**
 * Interface representing a language in Storyblok
 */
export type Language = NonNullable<Space['languages']>[number];

export interface SpaceInternationalization {
  languages: NonNullable<Space['languages']>;
  default_lang_name: string;
}

export interface StoryblokUser {
  id: number;
  email: string;
  username: string;
  friendly_name: string;
  otp_required: boolean;
  access_token: string;
  has_org: boolean;
  org: {
    name: string;
  };
  has_partner: boolean;
  created_at: string;
  updated_at: string;
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

import type { Region } from '@storyblok/region-helper';
import type { ListData as AssetsListData } from './generated/assets/types.gen';
import type {
  ListData as StoriesListData,
  StoryMapi,
} from './generated/stories/types.gen';
import type { Client, RetryOptions } from './generated/shared/client';
import type { ClientError } from './error';
import type { RateLimitConfig } from './utils/rate-limit';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ApiResponse<T, ThrowOnError extends boolean = false> =
  ThrowOnError extends true
    ? { data: T; response: Response; request: Request }
    : | { data: T; error: undefined; response: Response; request: Request }
      | { data: undefined; error: ClientError; response: Response; request: Request };

export interface RequestConfigOverrides {
  throwOnError?: boolean;
}

/**
 * Arbitrary options forwarded to the underlying `fetch()` call.
 *
 * Standard `RequestInit` properties (`cache`, `credentials`, `mode`, …) and
 * non-standard, vendor-specific properties (Next.js `next`, Cloudflare `cf`, …)
 * are both supported.
 *
 * @example
 * ```ts
 * client.stories.get(123, {
 *   fetchOptions: {
 *     cache: 'no-store',
 *     next: { revalidate: 60 },
 *   },
 * })
 * ```
 */
export type FetchOptions = Record<string, unknown>;

export interface HttpRequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  throwOnError?: RequestConfigOverrides['throwOnError'];
  fetchOptions?: FetchOptions;
}

/**
 * Dependencies injected into every resource factory.
 */
export interface MapiResourceDeps {
  client: Client;
  spaceId?: number;
  wrapRequest: <TData, ThrowOnError extends boolean = false>(fn: () => Promise<unknown>, throwOnError?: ThrowOnError) => Promise<ApiResponse<TData, ThrowOnError>>;
}

export interface ManagementApiClientConfig {
  /**
   * Personal access token for authentication.
   * Provide either `accessToken` or `oauthToken`.
   */
  accessToken?: string;
  /**
   * OAuth bearer token for authentication.
   * Provide either `accessToken` or `oauthToken`.
   */
  oauthToken?: string;
  /**
   * The Storyblok space ID. Used as the default for space-scoped endpoints.
   * You can also override it per request via `path.space_id`.
   */
  spaceId?: number;
  /**
   * Storyblok region. Determines the base URL.
   * @default 'eu'
   */
  region?: Region;
  /**
   * Override the base URL entirely (e.g. for testing).
   */
  baseUrl?: string;
  /**
   * Additional request headers.
   */
  headers?: Record<string, string>;
  /**
   * Throw on HTTP errors instead of returning them.
   * @default false
   */
  throwOnError?: boolean;
  /**
   * Retry configuration for failed requests.
   */
  retry?: RetryOptions;
  /**
   * Request timeout in milliseconds.
   * @default 30_000
   */
  timeout?: number;
  /**
   * Preventive rate limiting to avoid hitting the Storyblok Management API rate limits.
   *
   * - `undefined` (default): single bucket at maxConcurrency: 6.
   * - `number`: fixed max concurrent requests per second.
   * - `{ maxConcurrency?: number; adaptToServerHeaders?: boolean }`: full config.
   * - `false`: disable rate limiting entirely.
   */
  rateLimit?: RateLimitConfig | number | false;
}

export type { AssetFolder, AssetFolderCreate, AssetFolderUpdate } from './generated/asset_folders/types.gen';

export type { Asset, AssetSignRequest, AssetUpdate, AssetUpdateRequest, SignedResponseObject } from './generated/assets/types.gen';
export type AssetListQuery = NonNullable<AssetsListData['query']>;

export type { ComponentFolder } from './generated/component_folders/types.gen';
export type { Component, ComponentCreate, ComponentSchemaField, ComponentUpdate } from './generated/components/types.gen';

export type { DatasourceEntry, DatasourceEntryCreate, DatasourceEntryUpdate } from './generated/datasource_entries/types.gen';

export type { Datasource, DatasourceCreate, DatasourceUpdate } from './generated/datasources/types.gen';

export type { InternalTag } from './generated/internal_tags/types.gen';

export type Story = Prettify<StoryMapi>;
export type StoryListQuery = NonNullable<StoriesListData['query']>;

export type { Preset } from './generated/presets/types.gen';

export type { Space, SpaceCreate, SpaceUpdate } from './generated/spaces/types.gen';

export type {
  AssetField,
  MultilinkField,
  PluginField,
  RichtextField,
  StoryAlternate,
  StoryContent,
  StoryCreate,
  StoryLocalizedPath,
  StoryTranslatedSlug,
  StoryUpdate,
  TableField,
} from './generated/stories/types.gen';

// Users
export type { User } from './generated/users/types.gen';

export type { AssetCreate, AssetUploadRequest } from './resources/assets';

export type { RateLimitConfig };

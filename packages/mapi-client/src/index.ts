import type { Asset as AssetRaw } from './generated/assets/types.gen';
import type { Component as ComponentRaw } from './generated/components/types.gen';
import type { ComponentFolder as ComponentFolderRaw } from './generated/component_folders/types.gen';
import type { DatasourceEntry as DatasourceEntryRaw } from './generated/datasource_entries/types.gen';
import type { Datasource as DatasourceRaw } from './generated/datasources/types.gen';
import type { InternalTag as InternalTagRaw } from './generated/internal_tags/types.gen';
import type { Preset as PresetRaw } from './generated/presets/types.gen';
import type { Space as SpaceRaw } from './generated/spaces/types.gen';
import type {
  AssetField as AssetFieldRaw,
  MultilinkField as MultilinkFieldRaw,
  PluginField as PluginFieldRaw,
  RichtextField as RichtextFieldRaw,
  StoryMapi,
  TableField as TableFieldRaw,
} from './generated/stories/types.gen';
import type { Client, ResolvedRequestOptions, RetryOptions } from './generated/shared/client';
import type { Middleware } from './generated/shared/client/utils.gen';
import type { User as UserRaw } from './generated/users/types.gen';
import { createClient, createConfig } from './generated/shared/client';
import { getManagementBaseUrl, type Region } from '@storyblok/region-helper';
import { ClientError } from './error';
import type { RateLimitConfig } from './rate-limit';
import { createThrottleManager } from './rate-limit';
import { createAssetFoldersResource } from './resources/asset-folders';
import { createAssetsResource } from './resources/assets';
import { createComponentFoldersResource } from './resources/component-folders';
import { createComponentsResource } from './resources/components';
import { createDatasourceEntriesResource } from './resources/datasource-entries';
import { createDatasourcesResource } from './resources/datasources';
import { createInternalTagsResource } from './resources/internal-tags';
import { createPresetsResource } from './resources/presets';
import { createSpacesResource } from './resources/spaces';
import { createStoriesResource } from './resources/stories';
import { createUsersResource } from './resources/users';

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

export interface HttpRequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  throwOnError?: RequestConfigOverrides['throwOnError'];
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
   * - `undefined` (default): single bucket at maxConcurrent: 6.
   * - `number`: fixed max concurrent requests per second.
   * - `{ maxConcurrent?: number; adaptToServerHeaders?: boolean }`: full config.
   * - `false`: disable rate limiting entirely.
   */
  rateLimit?: RateLimitConfig | number | false;
}

function getAuthorizationHeader(config: ManagementApiClientConfig): string | undefined {
  if (config.accessToken) {
    return config.accessToken;
  }
  if (config.oauthToken) {
    return `Bearer ${config.oauthToken}`;
  }
  return undefined;
}

export const createManagementApiClient = (config: ManagementApiClientConfig) => {
  const {
    spaceId,
    region = 'eu',
    baseUrl,
    headers = {},
    throwOnError = false,
    retry = {
      limit: 12,
      backoffLimit: 20_000,
      methods: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'],
      statusCodes: [429],
    },
    timeout = 30_000,
    rateLimit,
  } = config;

  const throttleManager = createThrottleManager(rateLimit ?? {});
  const authHeader = getAuthorizationHeader(config);

  const client: Client = createClient(
    createConfig({
      baseUrl: baseUrl || getManagementBaseUrl(region),
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...headers,
      },
      throwOnError,
      kyOptions: {
        throwHttpErrors: true,
        timeout,
        retry,
      },
    }),
  );

  client.interceptors.error.use(
    (error: unknown, response: Response) =>
      new ClientError(response?.statusText || 'API request failed', {
        status: response?.status ?? 0,
        statusText: response?.statusText ?? '',
        data: error,
      }),
  );

  /**
   * Wraps an SDK call with throttling and response adaptation.
   * The throttle slot is held for the entire duration of the request.
   * When throwOnError is true, errors throw and data is guaranteed non-null.
   */
  function wrapRequest<TData, ThrowOnError extends boolean = false>(
    fn: () => Promise<unknown>,
    _throwOnError?: ThrowOnError,
  ): Promise<ApiResponse<TData, ThrowOnError>> {
    return throttleManager.execute(async () => {
      const result = await fn() as ApiResponse<TData, ThrowOnError>;
      throttleManager.adaptToResponse((result as { response: Response }).response);
      return result;
    }) as Promise<ApiResponse<TData, ThrowOnError>>;
  }

  const deps: MapiResourceDeps = { client, spaceId, wrapRequest };

  /**
   * Escape hatch: send a GET request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpGet = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData>> => {
    return wrapRequest<TData>(() =>
      client.get({ url: path, ...options }),
    );
  };

  /**
   * Escape hatch: send a POST request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpPost = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData>> => {
    return wrapRequest<TData>(() =>
      client.post({ url: path, ...options }),
    );
  };

  /**
   * Escape hatch: send a PUT request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpPut = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData>> => {
    return wrapRequest<TData>(() =>
      client.put({ url: path, ...options }),
    );
  };

  /**
   * Escape hatch: send a DELETE request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpDelete = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData>> => {
    return wrapRequest<TData>(() =>
      client.delete({ url: path, ...options }),
    );
  };

  return {
    assetFolders: createAssetFoldersResource(deps),
    assets: createAssetsResource(deps),
    componentFolders: createComponentFoldersResource(deps),
    components: createComponentsResource(deps),
    datasourceEntries: createDatasourceEntriesResource(deps),
    datasources: createDatasourcesResource(deps),
    delete: httpDelete,
    get: httpGet,
    interceptors: client.interceptors as Middleware<Request, Response, unknown, ResolvedRequestOptions>,
    internalTags: createInternalTagsResource(deps),
    post: httpPost,
    presets: createPresetsResource(deps),
    put: httpPut,
    spaces: createSpacesResource(deps),
    stories: createStoriesResource(deps),
    users: createUsersResource({ client, wrapRequest }),
  };
};

export type ManagementApiClient = ReturnType<typeof createManagementApiClient>;

export type { RateLimitConfig };
export { ClientError } from './error';

// Fields
export type AssetField = Prettify<AssetFieldRaw>;
export type MultilinkField = Prettify<MultilinkFieldRaw>;
export type PluginField = Prettify<PluginFieldRaw>;
export type RichtextField = Prettify<RichtextFieldRaw>;
export type TableField = Prettify<TableFieldRaw>;

// Components
export type Component = Prettify<ComponentRaw>;
export type ComponentFolder = Prettify<ComponentFolderRaw>;
export type { SignedResponseObject } from './generated/assets/types.gen';

// Assets
export type Asset = Prettify<AssetRaw>;
export type { ComponentCreate, ComponentUpdate } from './generated/components/types.gen';

// Datasources
export type Datasource = Prettify<DatasourceRaw>;
export type DatasourceEntry = Prettify<DatasourceEntryRaw>;
export type { DatasourceEntryCreate, DatasourceEntryUpdate } from './generated/datasource_entries/types.gen';
export type { DatasourceCreate, DatasourceUpdate } from './generated/datasources/types.gen';

// Spaces
export type Space = Prettify<SpaceRaw>;
export type { SpaceCreateRequest, SpaceUpdateRequest } from './generated/spaces/types.gen';

// Internal Tags
export type InternalTag = Prettify<InternalTagRaw>;

// Presets
export type Preset = Prettify<PresetRaw>;

// Stories
export type Story = Prettify<StoryMapi>;
export type { StoryCreate, StoryUpdate } from './generated/stories/types.gen';

// Users
export type User = Prettify<UserRaw>;

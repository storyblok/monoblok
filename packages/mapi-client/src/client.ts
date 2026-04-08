import type { Client, ResolvedRequestOptions, RetryOptions } from './generated/shared/client';
import type { Middleware } from './generated/shared/client/utils.gen';
import { createClient, createConfig } from './generated/shared/client';
import { getManagementBaseUrl } from '@storyblok/region-helper';
import type { Region } from '@storyblok/region-helper';
import type { Block as Component } from '@storyblok/schema';
import { ClientError } from './error';
import type { RateLimitConfig } from './utils/rate-limit';
import { createThrottleManager } from './utils/rate-limit';
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

// ---------------------------------------------------------------------------
// Client types (co-located with runtime)
// ---------------------------------------------------------------------------

export type ApiResponse<T, ThrowOnError extends boolean = false> =
  ThrowOnError extends true
    ? { data: T; error?: never; response: Response; request: Request }
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
export interface MapiResourceDeps<DefaultThrowOnError extends boolean = false> {
  client: Client;
  spaceId?: number;
  wrapRequest: <TData, ThrowOnError extends boolean = DefaultThrowOnError>(fn: () => Promise<unknown>, throwOnError?: ThrowOnError) => Promise<ApiResponse<TData, ThrowOnError>>;
}

type TokenConfig =
  | {
    /** Personal access token for authentication. */
    personalAccessToken: string;
    oauthToken?: never;
  }
  | {
    personalAccessToken?: never;
    /** OAuth bearer token for authentication. */
    oauthToken: string;
  }
  | {
    personalAccessToken?: undefined;
    oauthToken?: undefined;
  };

export type ManagementApiClientConfig<
  ThrowOnError extends boolean = false,
> = TokenConfig & {
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
  throwOnError?: ThrowOnError;
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
};

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function getAuthorizationHeader(config: ManagementApiClientConfig<boolean>): string | undefined {
  if (config.personalAccessToken) {
    return config.personalAccessToken;
  }
  if (config.oauthToken) {
    return config.oauthToken.startsWith('Bearer ')
      ? config.oauthToken
      : `Bearer ${config.oauthToken}`;
  }
  return undefined;
}

const createManagementApiClientBase = <DefaultThrowOnError extends boolean = false>(
  config: ManagementApiClientConfig<DefaultThrowOnError>,
): {
  deps: MapiResourceDeps<DefaultThrowOnError>;
  resources: Omit<ReturnType<typeof buildResources<DefaultThrowOnError>>, never>;
} => {
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

  function wrapRequest<TData, CurrentThrowOnError extends boolean = DefaultThrowOnError>(
    fn: () => Promise<unknown>,
    _throwOnError?: CurrentThrowOnError,
  ): Promise<ApiResponse<TData, CurrentThrowOnError>> {
    return throttleManager.execute(async () => {
      const result = await fn() as ApiResponse<TData, CurrentThrowOnError>;
      throttleManager.adaptToResponse((result as { response: Response }).response);
      return result;
    }) as Promise<ApiResponse<TData, CurrentThrowOnError>>;
  }

  const deps: MapiResourceDeps<DefaultThrowOnError> = { client, spaceId, wrapRequest };
  return { deps, resources: buildResources(deps, client) };
};

function buildResources<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
  client: Client,
) {
  /**
   * Escape hatch: send a GET request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpGet = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData, DefaultThrowOnError>> => {
    const { fetchOptions, ...rest } = options;
    return deps.wrapRequest<TData>(() =>
      client.get({ url: path, ...rest, ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }),
    );
  };

  /**
   * Escape hatch: send a POST request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpPost = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData, DefaultThrowOnError>> => {
    const { fetchOptions, ...rest } = options;
    return deps.wrapRequest<TData>(() =>
      client.post({ url: path, ...rest, ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }),
    );
  };

  /**
   * Escape hatch: send a PUT request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpPut = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData, DefaultThrowOnError>> => {
    const { fetchOptions, ...rest } = options;
    return deps.wrapRequest<TData>(() =>
      client.put({ url: path, ...rest, ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }),
    );
  };

  /**
   * Escape hatch: send a PATCH request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpPatch = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData, DefaultThrowOnError>> => {
    const { fetchOptions, ...rest } = options;
    return deps.wrapRequest<TData>(() =>
      client.patch({ url: path, ...rest, ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }),
    );
  };

  /**
   * Escape hatch: send a DELETE request to any MAPI endpoint not yet wrapped
   * in a dedicated resource method.
   */
  const httpDelete = <TData = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<ApiResponse<TData, DefaultThrowOnError>> => {
    const { fetchOptions, ...rest } = options;
    return deps.wrapRequest<TData>(() =>
      client.delete({ url: path, ...rest, ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }),
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
    patch: httpPatch,
    interceptors: client.interceptors as Middleware<Request, Response, unknown, ResolvedRequestOptions>,
    internalTags: createInternalTagsResource(deps),
    post: httpPost,
    presets: createPresetsResource(deps),
    put: httpPut,
    spaces: createSpacesResource(deps),
    users: createUsersResource<DefaultThrowOnError>({ client, wrapRequest: deps.wrapRequest }),
  };
}

interface StoryblokTypesConfig {
  components: Component;
}

/**
 * The return type of `createManagementApiClient`, parameterised by `TComponents` so that
 * `.stories` methods can narrow story content types without touching the runtime object.
 */
export type ManagementApiClient<
  TComponents extends Component = Component,
  DefaultThrowOnError extends boolean = false,
> = ReturnType<typeof buildResources<DefaultThrowOnError>> & {
  stories: ReturnType<typeof createStoriesResource<TComponents, DefaultThrowOnError>>;
  /**
   * Returns the same client instance cast to a version that narrows story content
   * to the provided component types. No runtime cost — type parameter is erased.
   *
   * @example
   * ```ts
   * import type { pageBlock, heroBlock } from './blocks';
   *
   * type StoryblokTypes = { components: typeof pageBlock | typeof heroBlock };
   *
   * const client = createManagementApiClient({ personalAccessToken: '...' })
   *   .withTypes<StoryblokTypes>();
   * ```
   */
  withTypes: <T extends StoryblokTypesConfig>() => ManagementApiClient<T['components'], DefaultThrowOnError>;
};

export const createManagementApiClient = <
  DefaultThrowOnError extends boolean = false,
>(
  config: ManagementApiClientConfig<DefaultThrowOnError>,
): ManagementApiClient<Component, DefaultThrowOnError> => {
  const { deps, resources } = createManagementApiClientBase(config);
  const self: ManagementApiClient<Component, DefaultThrowOnError> = {
    ...resources,
    stories: createStoriesResource<Component, DefaultThrowOnError>(deps),
    withTypes<T extends StoryblokTypesConfig>() {
      return self as unknown as ManagementApiClient<T['components'], DefaultThrowOnError>;
    },
  };
  return self;
};

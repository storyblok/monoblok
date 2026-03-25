import type { Client, ResolvedRequestOptions } from './generated/shared/client';
import type { Middleware } from './generated/shared/client/utils.gen';
import { createClient, createConfig } from './generated/shared/client';
import { getManagementBaseUrl } from '@storyblok/region-helper';
import { ClientError } from './error';
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
import type {
  ApiResponse,
  HttpRequestOptions,
  ManagementApiClientConfig,
  MapiResourceDeps,
} from './types';

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
    const { fetchOptions, ...rest } = options;
    return wrapRequest<TData>(() =>
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
  ): Promise<ApiResponse<TData>> => {
    const { fetchOptions, ...rest } = options;
    return wrapRequest<TData>(() =>
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
  ): Promise<ApiResponse<TData>> => {
    const { fetchOptions, ...rest } = options;
    return wrapRequest<TData>(() =>
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
  ): Promise<ApiResponse<TData>> => {
    const { fetchOptions, ...rest } = options;
    return wrapRequest<TData>(() =>
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
  ): Promise<ApiResponse<TData>> => {
    const { fetchOptions, ...rest } = options;
    return wrapRequest<TData>(() =>
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
    stories: createStoriesResource(deps),
    users: createUsersResource({ client, wrapRequest }),
  };
};

export type ManagementApiClient = ReturnType<typeof createManagementApiClient>;

export { ClientError } from './error';
export type {
  ApiResponse,
  Asset,
  AssetCreate,
  AssetField,
  AssetFolder,
  AssetFolderCreate,
  AssetFolderUpdate,
  AssetListQuery,
  AssetSignRequest,
  AssetUpdate,
  AssetUpdateRequest,
  AssetUploadRequest,
  Component,
  ComponentCreate,
  ComponentFolder,
  ComponentSchemaField,
  ComponentUpdate,
  Datasource,
  DatasourceCreate,
  DatasourceEntry,
  DatasourceEntryCreate,
  DatasourceEntryUpdate,
  DatasourceUpdate,
  FetchOptions,
  HttpRequestOptions,
  InternalTag,
  ManagementApiClientConfig,
  MapiResourceDeps,
  MultilinkField,
  PluginField,
  Preset,
  RateLimitConfig,
  RequestConfigOverrides,
  RichtextField,
  SignedResponseObject,
  Space,
  SpaceCreate,
  SpaceUpdate,
  Story,
  StoryAlternate,
  StoryContent,
  StoryCreate,
  StoryListQuery,
  StoryLocalizedPath,
  StoryTranslatedSlug,
  StoryUpdate,
  TableField,
  User,
} from './types';

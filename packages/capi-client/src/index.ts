import { createClient, createConfig } from './generated/stories/client';
import { get, getAll } from './generated/stories/sdk.gen';
import type { GetAllData, GetAllResponses, GetData, GetResponses } from './generated/stories/types.gen';
import { getAll as getAllLinks } from './generated/links/sdk.gen';
import type { LinkCapi, GetAllData as LinksGetAllData, GetAllResponses as LinksGetAllResponses } from './generated/links/types.gen';
import { getAll as getAllDatasourceEntriesApi } from './generated/datasource-entries/sdk.gen';
import type { GetAllData as DatasourceEntriesGetAllData, GetAllResponses as DatasourceEntriesGetAllResponses, DatasourceEntryCapi } from './generated/datasource-entries/types.gen';
import { getAll as getAllTagsApi } from './generated/tags/sdk.gen';
import type { TagCapi, GetAllData as TagsGetAllData, GetAllResponses as TagsGetAllResponses } from './generated/tags/types.gen';
import { getAll as getAllDatasourcesApi, get as getDatasourceApi } from './generated/datasources/sdk.gen';
import type { DatasourceCapi, GetAllData as DatasourcesGetAllData, GetAllResponses as DatasourcesGetAllResponses, GetData as DatasourcesGetData, GetResponses as DatasourcesGetResponses } from './generated/datasources/types.gen';
import type {
  AssetField,
  MultilinkField,
  PluginField,
  RichtextField,
  StoryCapi,
  StoryContent,
  TableField,
} from './generated/stories';
import type { CacheProvider, CacheStrategy, CacheStrategyHandler } from './cache';
import { createMemoryCacheProvider, createStrategy } from './cache';
import type { RateLimitConfig } from './rate-limit';
import { createThrottleManager } from './rate-limit';
import { applyCvToQuery, extractCv } from './utils/cv';
import { fetchMissingRelations } from './utils/fetch-rel-uuids';
import { buildRelationMap, inlineStoriesContent, inlineStoryContent, parseResolveRelations } from './utils/inline-relations';
import { createCacheKey, shouldUseCache } from './utils/request';
import { getRegionBaseUrl, type Region } from '@storyblok/region-helper';
import type { RetryOptions } from 'ky';
import type { Client, RequestOptions } from './generated/stories/client';
import { get as getSpaceApi } from './generated/spaces/sdk.gen';
import type { SpaceCapi, GetResponses as SpacesGetResponses } from './generated/spaces/types.gen';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Story = Prettify<StoryCapi>;
export type Link = Prettify<LinkCapi>;
export type Space = Prettify<SpaceCapi>;
export type Datasource = Prettify<DatasourceCapi>;
export type DatasourceEntry = Prettify<DatasourceEntryCapi>;
export type Tag = Prettify<TagCapi>;

type InlinedStoryContentField =
  | string
  | number
  | boolean
  | Array<string | AssetField | StoryContent | StoryWithInlinedRelations>
  | AssetField
  | MultilinkField
  | TableField
  | RichtextField
  | PluginField
  | StoryWithInlinedRelations
  | undefined;

interface InlinedStoryContent {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: InlinedStoryContentField;
}

export type StoryWithInlinedRelations = Prettify<Omit<Story, 'content'> & {
  content: InlinedStoryContent;
}>;

type StoryResult<InlineRelations extends boolean> = InlineRelations extends true
  ? StoryWithInlinedRelations
  : Story;

// Helper type to replace StoryCapi with Story in response types
type ReplaceStory<T, InlineRelations extends boolean> = T extends StoryCapi
  ? StoryResult<InlineRelations>
  : T extends Array<StoryCapi>
    ? Array<StoryResult<InlineRelations>>
    : T extends Array<infer U>
      ? Array<ReplaceStory<U, InlineRelations>>
      : T extends object
        ? { [K in keyof T]: ReplaceStory<T[K], InlineRelations> }
        : T;

// Transform response types to use Story instead of StoryCapi
type GetResponse<InlineRelations extends boolean> = ReplaceStory<GetResponses[200], InlineRelations>;
type GetAllResponse<InlineRelations extends boolean> = ReplaceStory<GetAllResponses[200], InlineRelations>;

type ApiResponse<T> =
  | { data: T; error: undefined; response: Response; request: Request }
  | { data: undefined; error: unknown; response: Response; request: Request };

type GenericRequestOptions<ThrowOnError extends boolean = false> = Omit<
  RequestOptions<unknown, 'fields', ThrowOnError>,
  'method' | 'security' | 'throwOnError' | 'url'
>;

type GenericRequestMethod<ThrowOnError extends boolean = false> = <TData = unknown>(
  path: string,
  options?: GenericRequestOptions<ThrowOnError>,
) => Promise<ApiResponse<TData>>;

interface CacheConfig {
  provider?: CacheProvider;
  strategy?: CacheStrategy | CacheStrategyHandler;
  ttlMs?: number;
}

export interface ContentApiClientConfig<
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
> {
  accessToken: string;
  region?: Region;
  baseUrl?: string;
  headers?: Record<string, string>;
  throwOnError?: ThrowOnError;
  cache?: CacheConfig;
  inlineRelations?: InlineRelations;
  retry?: RetryOptions;
  /**
   * Preventive rate limiting to avoid hitting the Storyblok CDN rate limits.
   *
   * - `undefined` (default): auto-detect tier from path + `per_page` query param.
   * - `number`: fixed max concurrent requests per second (single queue).
   * - `{ maxConcurrent?: number; adaptToServerHeaders?: boolean }`: full config.
   * - `false`: disable rate limiting entirely.
   */
  rateLimit?: RateLimitConfig | number | false;
}

export const createApiClient = <
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
>(
  config: ContentApiClientConfig<ThrowOnError, InlineRelations>,
) => {
  const {
    accessToken,
    region = 'eu',
    baseUrl,
    headers = {},
    throwOnError = false,
    cache = {},
    inlineRelations = false as InlineRelations,
    retry,
    rateLimit,
  } = config;
  const retryOptions: RetryOptions = { limit: 3, backoffLimit: 20_000, jitter: true, ...retry };
  // `rateLimit` defaults to `{}` (auto-detect mode) when not supplied.
  const throttleManager = createThrottleManager(rateLimit ?? {});
  const cacheProvider = cache.provider ?? createMemoryCacheProvider();
  const strategy = cache.strategy
    ? typeof cache.strategy === 'string'
      ? createStrategy(cache.strategy)
      : cache.strategy
    : createStrategy('cache-first');
  const cacheTtlMs = cache.ttlMs ?? 60_000;
  let currentCv: number | undefined;

  const client: Client = createClient(
    createConfig({
      auth: accessToken,
      baseUrl: baseUrl || getRegionBaseUrl(region),
      headers,
      throwOnError,
      kyOptions: {
        // Enable `throwHttpErrors` to make retry work, even if `throwOnError`
        // is `false`. The client's error handling will still work because it
        // catches `HTTPError`.
        throwHttpErrors: true,
        timeout: 30_000,
        retry: retryOptions,
      },
    }),
  );

  const security = [
    {
      in: 'query' as const,
      name: 'token',
      type: 'apiKey' as const,
    },
  ];

  const updateCv = async (result: ApiResponse<unknown>) => {
    const nextCv = extractCv(result.data);
    if (nextCv === undefined) {
      return;
    }

    if (currentCv !== undefined && currentCv !== nextCv) {
      await cacheProvider.flush();
    }

    currentCv = nextCv;
  };

  const cacheSuccessResult = async <TResponse extends ApiResponse<unknown>>(key: string, result: TResponse) => {
    await updateCv(result);
    if (result.error === undefined) {
      await cacheProvider.set(key, {
        value: result,
        ttlMs: cacheTtlMs,
      });
    }
    return result;
  };

  const requestNetwork = async <TData = unknown, TError = unknown>(
    method: 'GET',
    path: string,
    query: Record<string, unknown>,
    options: GenericRequestOptions<ThrowOnError>,
  ): Promise<ApiResponse<TData>> => {
    return client.request<TData, TError, ThrowOnError>({
      ...options,
      method,
      query,
      security,
      url: path,
    }) as Promise<ApiResponse<TData>>;
  };

  const requestWithCache = async <TData = unknown>(
    method: 'GET',
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData>>,
  ): Promise<ApiResponse<TData>> => {
    const query = currentCv !== undefined ? applyCvToQuery(rawQuery, currentCv) : rawQuery;
    const cacheEnabled = shouldUseCache(method, path, rawQuery);

    if (!cacheEnabled) {
      const networkResult = await throttleManager.execute(path, rawQuery, () => fetchFn(query));
      throttleManager.adaptToResponse(networkResult.response);
      await updateCv(networkResult);
      return networkResult;
    }

    const key = createCacheKey(method, path, rawQuery);
    const cachedEntry = await cacheProvider.get<ApiResponse<TData>>(key);
    const cachedResult = cachedEntry?.value;

    const loadNetwork = async () => {
      const result = await throttleManager.execute(path, rawQuery, () => fetchFn(query));
      throttleManager.adaptToResponse(result.response);
      return cacheSuccessResult(key, result);
    };

    return strategy({
      key,
      cachedResult,
      loadNetwork,
    });
  };

  const request = async <TData = unknown, TError = unknown>(
    method: 'GET',
    path: string,
    options: GenericRequestOptions<ThrowOnError> = {},
  ): Promise<ApiResponse<TData>> => {
    const rawQuery = options.query || {};

    return requestWithCache<TData>(method, path, rawQuery, (query) => {
      return requestNetwork<TData, TError>(method, path, query, options);
    });
  };

  const getRequest: GenericRequestMethod<ThrowOnError> = <TData = unknown>(
    path: string,
    options: GenericRequestOptions<ThrowOnError> = {},
  ) => {
    return request<TData>('GET', path, options);
  };

  /**
   * Retrieve a single story
   * @param identifier - Story identifier - can be full_slug (string), id (number), or uuid (string). When using uuid, the find_by=uuid query parameter is required.
   * @param query - Query parameters for the request
   */
  const getStory = async (
    identifier: GetData['path']['identifier'],
    query: GetData['query'] = {},
  ): Promise<ApiResponse<GetResponse<InlineRelations>>> => {
    const requestPath = `/v2/cdn/stories/${identifier}`;
    return requestWithCache<GetResponse<InlineRelations>>('GET', requestPath, query, async (requestQuery) => {
      const response = await get({
        client,
        path: { identifier },
        query: requestQuery,
      });

      if (!inlineRelations || response.data === undefined) {
        return response;
      }

      const relationPaths = parseResolveRelations(requestQuery);
      if (relationPaths.length === 0) {
        return response;
      }

      const relationMap = buildRelationMap(response.data.rels);
      if (response.data.rel_uuids?.length) {
        const fetchedRelations = await fetchMissingRelations({
          client,
          uuids: response.data.rel_uuids,
          baseQuery: requestQuery,
          throttleManager,
        });
        for (const relationStory of fetchedRelations) {
          relationMap.set(relationStory.uuid, relationStory);
        }
      }

      return {
        ...response,
        data: {
          ...response.data,
          story: inlineStoryContent(response.data.story, relationPaths, relationMap),
        },
      } as ApiResponse<GetResponse<InlineRelations>>;
    });
  };

  /**
   * Retrieve multiple stories
   * @param query - Query parameters for filtering and pagination
   */
  const getAllStories = async (
    query: GetAllData['query'] = {},
  ): Promise<ApiResponse<GetAllResponse<InlineRelations>>> => {
    const requestPath = '/v2/cdn/stories';
    return requestWithCache<GetAllResponse<InlineRelations>>('GET', requestPath, query, async (requestQuery) => {
      const response = await getAll({
        client,
        query: requestQuery,
      });

      if (!inlineRelations || response.data === undefined) {
        return response;
      }

      const relationPaths = parseResolveRelations(requestQuery);
      if (relationPaths.length === 0) {
        return response;
      }

      const relationMap = buildRelationMap(response.data.rels);
      if (response.data.rel_uuids?.length) {
        const fetchedRelations = await fetchMissingRelations({
          client,
          uuids: response.data.rel_uuids,
          baseQuery: requestQuery,
          throttleManager,
        });
        for (const relationStory of fetchedRelations) {
          relationMap.set(relationStory.uuid, relationStory);
        }
      }

      return {
        ...response,
        data: {
          ...response.data,
          stories: inlineStoriesContent(response.data.stories, relationPaths, relationMap),
        },
      } as ApiResponse<GetAllResponse<InlineRelations>>;
    });
  };

  /**
   * Retrieve multiple links
   * @param query - Query parameters for filtering and pagination
   */
  const getLinks = async (
    query: LinksGetAllData['query'] = {},
  ): Promise<ApiResponse<LinksGetAllResponses[200]>> => {
    const requestPath = '/v2/cdn/links';
    return requestWithCache<LinksGetAllResponses[200]>('GET', requestPath, query, async (requestQuery) => {
      const response = await getAllLinks({
        client,
        query: requestQuery,
      });
      return response;
    });
  };

  /**
   * Retrieve multiple datasource entries
   * @param query - Query parameters for filtering and pagination
   */
  const getAllDatasourceEntries = async (
    query: DatasourceEntriesGetAllData['query'] = {},
  ): Promise<ApiResponse<DatasourceEntriesGetAllResponses[200]>> => {
    const requestPath = '/v2/cdn/datasource_entries';
    return requestWithCache<DatasourceEntriesGetAllResponses[200]>('GET', requestPath, query, async (requestQuery) => {
      const response = await getAllDatasourceEntriesApi({
        client,
        query: requestQuery,
      });
      return response;
    });
  };

  const getSpace = async (): Promise<ApiResponse<SpacesGetResponses[200]>> => {
    const requestPath = '/v2/cdn/spaces/me';
    return requestWithCache<SpacesGetResponses[200]>('GET', requestPath, {}, async (_requestQuery) => {
      const response = await getSpaceApi({
        client,
      });
      return response;
    });
  };

  /**
   * Retrieve all tags
   * @param query - Query parameters for filtering
   */
  const getAllTags = async (
    query: TagsGetAllData['query'] = {},
  ): Promise<ApiResponse<TagsGetAllResponses[200]>> => {
    const requestPath = '/v2/cdn/tags';
    return requestWithCache<TagsGetAllResponses[200]>('GET', requestPath, query, async (requestQuery) => {
      const response = await getAllTagsApi({
        client,
        query: requestQuery,
      });
      return response;
    });
  };

  const getDatasource = async (
    id: DatasourcesGetData['path']['id'],
  ): Promise<ApiResponse<DatasourcesGetResponses[200]>> => {
    const requestPath = `/v2/cdn/datasources/${id}`;
    return requestWithCache<DatasourcesGetResponses[200]>('GET', requestPath, {}, async () => {
      const response = await getDatasourceApi({
        client,
        path: { id },
      });
      return response;
    });
  };

  const getAllDatasources = async (
    query: DatasourcesGetAllData['query'] = {},
  ): Promise<ApiResponse<DatasourcesGetAllResponses[200]>> => {
    const requestPath = '/v2/cdn/datasources';
    return requestWithCache<DatasourcesGetAllResponses[200]>('GET', requestPath, query ?? {}, async (requestQuery) => {
      const response = await getAllDatasourcesApi({
        client,
        query: requestQuery,
      });
      return response;
    });
  };

  const stories = {
    get: getStory,
    getAll: getAllStories,
  };

  const links = {
    getAll: getLinks,
  };

  const datasourceEntries = {
    getAll: getAllDatasourceEntries,
  };

  const spaces = {
    get: getSpace,
  };

  const tags = {
    getAll: getAllTags,
  };

  const datasources = {
    get: getDatasource,
    getAll: getAllDatasources,
  };

  return {
    datasourceEntries,
    datasources,
    get: getRequest,
    links,
    spaces,
    stories,
    tags,
  };
};

export type { CacheProvider, CacheStrategy, CacheStrategyHandler };
export type { RateLimitConfig };

import { get, list } from '../generated/stories/sdk.gen';
import type { GetData, GetResponses, ListData, ListResponses } from '../generated/stories/types.gen';
import type {
  AssetField,
  MultilinkField,
  PluginField,
  RichtextField,
  StoryCapi,
  StoryContent,
  TableField,
} from '../generated/stories';
import { inlineStoriesContent, inlineStoryContent, resolveRelationMap } from '../utils/inline-relations';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../types';

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

export type StoryWithInlinedRelations = Omit<StoryCapi, 'content'> & {
  content: InlinedStoryContent;
};

type StoryResult<InlineRelations extends boolean> = InlineRelations extends true
  ? StoryWithInlinedRelations
  : StoryCapi;

type GetResponse<InlineRelations extends boolean> = Omit<GetResponses[200], 'story'> & {
  story: StoryResult<InlineRelations>;
};
type ListResponse<InlineRelations extends boolean> = Omit<ListResponses[200], 'stories'> & {
  stories: Array<StoryResult<InlineRelations>>;
};

/** Pre-resolved to avoid TypeScript emitting deep indexed-access chains that trip up DTS bundlers. */
type StoryIdentifier = GetData['path']['identifier'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoriesResourceDeps extends ResourceDeps {
  inlineRelations: boolean;
}

export function createStoriesResource<InlineRelations extends boolean>(
  deps: StoriesResourceDeps,
) {
  const { client, requestWithCache, asApiResponse, inlineRelations, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = false>(
      identifier: StoryIdentifier,
      options: { query?: GetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<GetResponse<InlineRelations>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const resolvedQuery = typeof identifier === 'string' && UUID_RE.test(identifier) && !query.find_by
        ? { ...query, find_by: 'uuid' as const }
        : query;
      const requestPath = `/v2/cdn/stories/${identifier}`;
      type Res = ApiResponse<GetResponse<InlineRelations>, ThrowOnError>;
      return requestWithCache<GetResponse<InlineRelations>, ThrowOnError>('GET', requestPath, resolvedQuery, async (requestQuery: Record<string, unknown>): Promise<Res> => {
        const response = await throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<GetResponse<InlineRelations>, ThrowOnError>(get({
            client,
            path: { identifier },
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
          })));

        if (!inlineRelations || response.data === undefined) {
          return response;
        }

        const resolved = await resolveRelationMap(response.data, requestQuery, { client, throttleManager });
        if (!resolved) {
          return response;
        }

        return {
          ...response,
          data: {
            ...response.data,
            story: inlineStoryContent(response.data.story, resolved.relationPaths, resolved.relationMap),
          },
        };
      }, inlineRelations ? { cacheKeyPrefix: 'inline' } : undefined);
    },

    list: async <ThrowOnError extends boolean = false>(
      options: { query?: ListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<ListResponse<InlineRelations>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/stories';
      type ResAll = ApiResponse<ListResponse<InlineRelations>, ThrowOnError>;
      return requestWithCache<ListResponse<InlineRelations>, ThrowOnError>('GET', requestPath, query, async (requestQuery: Record<string, unknown>): Promise<ResAll> => {
        const response = await throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<ListResponse<InlineRelations>, ThrowOnError>(list({
            client,
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
          })));

        if (!inlineRelations || response.data === undefined) {
          return response;
        }

        const resolved = await resolveRelationMap(response.data, requestQuery, { client, throttleManager });
        if (!resolved) {
          return response;
        }

        return {
          ...response,
          data: {
            ...response.data,
            stories: inlineStoriesContent(response.data.stories, resolved.relationPaths, resolved.relationMap),
          },
        };
      }, inlineRelations ? { cacheKeyPrefix: 'inline' } : undefined);
    },
  };
}

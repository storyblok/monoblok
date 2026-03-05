import { get, getAll } from '../generated/stories/sdk.gen';
import type { GetAllData, GetAllResponses, GetData, GetResponses } from '../generated/stories/types.gen';
import type {
  AssetField,
  MultilinkField,
  PluginField,
  RichtextField,
  StoryCapi,
  StoryContent,
  TableField,
} from '../generated/stories';
import { fetchMissingRelations } from '../utils/fetch-rel-uuids';
import { buildRelationMap, inlineStoriesContent, inlineStoryContent, parseResolveRelations } from '../utils/inline-relations';
import type { ApiResponse, ResourceDeps } from '../types';
import type { ThrottleManager } from '../utils/rate-limit';

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

type ReplaceStory<T, InlineRelations extends boolean> = T extends StoryCapi
  ? StoryResult<InlineRelations>
  : T extends Array<StoryCapi>
    ? Array<StoryResult<InlineRelations>>
    : T extends Array<infer U>
      ? Array<ReplaceStory<U, InlineRelations>>
      : T extends object
        ? { [K in keyof T]: ReplaceStory<T[K], InlineRelations> }
        : T;

type GetResponse<InlineRelations extends boolean> = ReplaceStory<GetResponses[200], InlineRelations>;
type GetAllResponse<InlineRelations extends boolean> = ReplaceStory<GetAllResponses[200], InlineRelations>;

/** Pre-resolved to avoid TypeScript emitting deep indexed-access chains that trip up DTS bundlers. */
type StoryIdentifier = GetData['path']['identifier'];

export interface StoriesResourceDeps extends ResourceDeps {
  inlineRelations: boolean;
  throttleManager: ThrottleManager;
}

export function createStoriesResource<InlineRelations extends boolean>(
  deps: StoriesResourceDeps,
) {
  const { client, requestWithCache, asApiResponse, inlineRelations, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = false>(
      identifier: StoryIdentifier,
      options: { query?: GetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<GetResponse<InlineRelations>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const requestPath = `/v2/cdn/stories/${identifier}`;
      type Res = ApiResponse<GetResponse<InlineRelations>, ThrowOnError>;
      return requestWithCache<GetResponse<InlineRelations>, ThrowOnError>('GET', requestPath, query, async (requestQuery: Record<string, unknown>): Promise<Res> => {
        const response = await asApiResponse<GetResponse<InlineRelations>, ThrowOnError>(get({
          client,
          path: { identifier },
          query: requestQuery,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }));

        if (!inlineRelations || response.data === undefined) {
          return response as Res; // TS cannot resolve conditional ApiResponse with generic ThrowOnError
        }

        const relationPaths = parseResolveRelations(requestQuery);
        if (relationPaths.length === 0) {
          return response as Res; // same: conditional type unresolvable with generic ThrowOnError
        }

        // Generated `rels` type is broader; API contract guarantees StoryCapi[] here.
        const relationMap = buildRelationMap(response.data.rels as StoryCapi[] | undefined);
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
            // Pre-inlining: story is still raw StoryCapi; the ReplaceStory mapped type is applied by inlineStoryContent.
            story: inlineStoryContent(response.data.story as StoryCapi, relationPaths, relationMap),
          },
        } as Res; // spread loses conditional type precision; result matches Res structurally
      });
    },

    getAll: async <ThrowOnError extends boolean = false>(
      options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<GetAllResponse<InlineRelations>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const requestPath = '/v2/cdn/stories';
      type ResAll = ApiResponse<GetAllResponse<InlineRelations>, ThrowOnError>;
      return requestWithCache<GetAllResponse<InlineRelations>, ThrowOnError>('GET', requestPath, query, async (requestQuery: Record<string, unknown>): Promise<ResAll> => {
        const response = await asApiResponse<GetAllResponse<InlineRelations>, ThrowOnError>(getAll({
          client,
          query: requestQuery,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }));

        if (!inlineRelations || response.data === undefined) {
          return response as ResAll; // TS cannot resolve conditional ApiResponse with generic ThrowOnError
        }

        const relationPaths = parseResolveRelations(requestQuery);
        if (relationPaths.length === 0) {
          return response as ResAll; // same: conditional type unresolvable with generic ThrowOnError
        }

        // Generated `rels` type is broader; API contract guarantees StoryCapi[] here.
        const relationMap = buildRelationMap(response.data.rels as StoryCapi[] | undefined);
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
            // Pre-inlining: stories are still raw StoryCapi[]; the ReplaceStory mapped type is applied by inlineStoriesContent.
            stories: inlineStoriesContent(response.data.stories as StoryCapi[], relationPaths, relationMap),
          },
        } as ResAll; // spread loses conditional type precision; result matches ResAll structurally
      });
    },
  };
}

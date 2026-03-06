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
import { inlineStoriesContent, inlineStoryContent, resolveRelationMap } from '../utils/inline-relations';
import type { ApiResponse, ResourceDeps } from '../types';
import type { Component, Story as SchemaStory } from '@storyblok/schema';

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

/**
 * Resolves to a narrowed Schema-derived story type when Schema is a specific
 * Component union, or falls back to the generated StoryCapi / StoryWithInlinedRelations
 * when Schema is the default Component base type (no type argument provided).
 *
 * Uses a two-step conditional to:
 * 1. Detect whether Schema is the default base Component (fallback path).
 * 2. Distribute SchemaStory over the union members of Schema so that
 *    TypeScript produces a proper discriminated union, while passing the
 *    full undistributed FullSchema as the second argument so that nested
 *    blok fields can look up the complete set of component types.
 */
type StoryResult<Schema extends Component, InlineRelations extends boolean, FullSchema extends Component = Schema> =
  Component extends Schema
    ? InlineRelations extends true ? StoryWithInlinedRelations : StoryCapi // fallback
    : Schema extends Component ? SchemaStory<Schema, FullSchema> : never; // distribute over union

type GetResponse<Schema extends Component, InlineRelations extends boolean, FullSchema extends Component = Schema> = Omit<GetResponses[200], 'story'> & {
  story: StoryResult<Schema, InlineRelations, FullSchema>;
};
type GetAllResponse<Schema extends Component, InlineRelations extends boolean, FullSchema extends Component = Schema> = Omit<GetAllResponses[200], 'stories'> & {
  stories: Array<StoryResult<Schema, InlineRelations, FullSchema>>;
};

/** Pre-resolved to avoid TypeScript emitting deep indexed-access chains that trip up DTS bundlers. */
type StoryIdentifier = GetData['path']['identifier'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoriesResourceDeps extends ResourceDeps {
  inlineRelations: boolean;
}

export function createStoriesResource<
  Schema extends Component = Component,
  InlineRelations extends boolean = false,
>(
  deps: StoriesResourceDeps,
) {
  const { client, requestWithCache, asApiResponse, inlineRelations, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = false>(
      identifier: StoryIdentifier,
      options: { query?: GetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<GetResponse<Schema, InlineRelations>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const resolvedQuery = typeof identifier === 'string' && UUID_RE.test(identifier) && !query.find_by
        ? { ...query, find_by: 'uuid' as const }
        : query;
      const requestPath = `/v2/cdn/stories/${identifier}`;
      type Res = ApiResponse<GetResponse<Schema, InlineRelations>, ThrowOnError>;
      return requestWithCache<GetResponse<Schema, InlineRelations>, ThrowOnError>('GET', requestPath, resolvedQuery, async (requestQuery: Record<string, unknown>): Promise<Res> => {
        const response = await throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<GetResponse<Schema, InlineRelations>, ThrowOnError>(get({
            client,
            path: { identifier },
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
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
            // TODO cast seems unnecessary
            story: inlineStoryContent(response.data.story as StoryCapi, resolved.relationPaths, resolved.relationMap) as StoryResult<Schema, InlineRelations>,
          },
        };
      });
    },

    getAll: async <ThrowOnError extends boolean = false>(
      options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<GetAllResponse<Schema, InlineRelations>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const requestPath = '/v2/cdn/stories';
      type ResAll = ApiResponse<GetAllResponse<Schema, InlineRelations>, ThrowOnError>;
      return requestWithCache<GetAllResponse<Schema, InlineRelations>, ThrowOnError>('GET', requestPath, query, async (requestQuery: Record<string, unknown>): Promise<ResAll> => {
        const response = await throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<GetAllResponse<Schema, InlineRelations>, ThrowOnError>(getAll({
            client,
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
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
            // TODO cast seems unnecessary
            stories: inlineStoriesContent(response.data.stories as StoryCapi[], resolved.relationPaths, resolved.relationMap) as Array<StoryResult<Schema, InlineRelations>>,
          },
        };
      });
    },
  };
}

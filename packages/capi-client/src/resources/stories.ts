import { getStoryById, listStories } from '../generated/capi/sdk.gen';
import type { GetStoryByIdData as GetData, GetStoryByIdResponses as GetResponses, ListStoriesData as ListData, ListStoriesResponses as ListResponses } from '../generated/capi/types.gen';
import type {
  AssetFieldValue,
  BlockContent as BlokContent,
  MultilinkFieldValue,
  PluginFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from '../generated/types/field';
import { inlineStoriesContent, inlineStoryContent, resolveRelationMap } from '../utils/inline-relations';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../client';
import type { Block as Component, RootBlocks as RootComponents } from '../generated/types/block';
import type { Story } from '../generated/types/story';

type InlinedStoryContentField =
  | string
  | number
  | boolean
  | Array<string | AssetFieldValue | BlokContent | StoryWithInlinedRelations>
  | AssetFieldValue
  | MultilinkFieldValue
  | TableFieldValue
  | RichtextFieldValue
  | PluginFieldValue
  | StoryWithInlinedRelations
  | undefined;

interface InlinedStoryContent {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: InlinedStoryContentField;
}

export type StoryWithInlinedRelations = Omit<Story, 'content'> & {
  content: InlinedStoryContent;
};

/** Splits `"comp.field,comp2.field2"` into a union of `{ component, field }`. */
type ParseRelations<T extends string> =
  T extends `${infer Comp}.${infer Field},${infer Rest}`
    ? { component: Comp; field: Field } | ParseRelations<Rest>
    : T extends `${infer Comp}.${infer Field}`
      ? { component: Comp; field: Field }
      : never;

/** Extracts resolved field names for a given component name. */
type ResolvedFieldsFor<R extends string, ComponentName extends string> =
  Extract<ParseRelations<R>, { component: ComponentName }>['field'];

/** A resolved relation: a full story typed to the component union. */
type ResolvedRelation<TComponents extends Component> =
  { [K in TComponents as K['name']]: Story<K, TComponents> }[TComponents['name']];

/**
 * Given a story type and a set of resolved field names, replaces
 * those fields with `ResolvedRelation<TComponents>` (a full story object).
 */
type WithResolvedRelations<
  TStory,
  TComponents extends Component,
  Fields extends string,
> = TStory extends { content: infer C } ? Omit<TStory, 'content'> & {
  content: {
    [K in keyof C]: K extends Fields ? ResolvedRelation<TComponents> : C[K]
  };
}
  : TStory;

/**
 * Resolves to a narrowed component-derived story type when `TComponents` is a specific
 * Component union, or falls back to the generated Story / StoryWithInlinedRelations
 * when `TComponents` is the default Component base type (no type argument provided).
 *
 * When `ResolveRelations` is a string literal (e.g. `"article.author"`),
 * matched fields are widened from their schema type to `ResolvedRelation<TComponents>`
 * — a full story object typed to the component union.
 *
 * Uses a mapped-type approach instead of a distributive conditional with a
 * separate full-components parameter. This ensures the full `TComponents` union is
 * preserved even when DTS bundlers (like tsdown) inline the type alias —
 * a distributive conditional + default-parameter pattern would collapse
 * both parameters to the distributed single member after inlining.
 *
 * The mapped type `{ [K in TComponents as K["name"]]: Story<K, TComponents> }`
 * iterates each union member as `K` while keeping `TComponents` as the full union
 * for nested blok field resolution. The final indexed access
 * `[TComponents["name"]]` produces the discriminated union of all story types.
 */
type StoryResult<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
> =
  Component extends TComponents
    ? InlineRelations extends true ? StoryWithInlinedRelations : Story // fallback
    : ResolveRelationsRaw extends string
      ? {
          [K in RootComponents<TComponents> as K['name']]: WithResolvedRelations<
            Story<K, TComponents>,
            TComponents,
            ResolvedFieldsFor<ResolveRelationsRaw, K['name']>
          >
        }[RootComponents<TComponents>['name']]
      : Story<TComponents>;

type GetResponse<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
> = Omit<GetResponses[200], 'story'> & {
  story: StoryResult<TComponents, InlineRelations, ResolveRelationsRaw>;
};
type ListResponse<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
> = Omit<ListResponses[200], 'stories'> & {
  stories: Array<StoryResult<TComponents, InlineRelations, ResolveRelationsRaw>>;
};

interface StoryRelationData {
  rels?: Story[];
  rel_uuids?: string[];
}

interface StoryData extends StoryRelationData {
  story: Story;
}

interface StoriesData extends StoryRelationData {
  stories: Story[];
}

/** Pre-resolved to avoid TypeScript emitting deep indexed-access chains that trip up DTS bundlers. */
type StoryIdentifier = GetData['path']['id'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoriesResourceDeps<DefaultThrowOnError extends boolean = false> extends ResourceDeps<DefaultThrowOnError> {
  inlineRelations: boolean;
}

export function createStoriesResource<
  TComponents extends Component = Component,
  InlineRelations extends boolean = false,
  DefaultThrowOnError extends boolean = false,
>(
  deps: StoriesResourceDeps<DefaultThrowOnError>,
) {
  const { client, requestWithCache, asApiResponse, inlineRelations, throttleManager } = deps;

  return {
    get: async <
      ThrowOnError extends boolean = DefaultThrowOnError,
      const ResolveRelationsStr extends string | undefined = undefined,
    >(
      identifier: StoryIdentifier,
      options: { query?: Omit<NonNullable<GetData['query']>, 'resolve_relations'> & { resolve_relations?: ResolveRelationsStr }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<GetResponse<TComponents, InlineRelations, ResolveRelationsStr>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const typedQuery = (query ?? {}) as NonNullable<GetData['query']>;
      const resolvedQuery = typeof identifier === 'string' && UUID_RE.test(identifier) && !typedQuery.find_by
        ? { ...typedQuery, find_by: 'uuid' }
        : typedQuery;
      const requestPath = `/v2/cdn/stories/${identifier}`;
      return requestWithCache('GET', requestPath, resolvedQuery, async (requestQuery: Record<string, unknown>) => {
        const response = await throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse(getStoryById({
            client,
            path: { id: identifier },
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
          }))) satisfies ApiResponse<GetResponse<TComponents, InlineRelations, ResolveRelationsStr>, ThrowOnError>;

        if (!inlineRelations || response.data === undefined) {
          return response;
        }

        const storyData = response.data as unknown as StoryData;
        const resolved = await resolveRelationMap(storyData, requestQuery, { client, throttleManager });
        if (!resolved) {
          return response;
        }

        return {
          ...response,
          data: {
            ...response.data,
            story: inlineStoryContent(storyData.story, resolved.relationPaths, resolved.relationMap),
          },
        };
      }, inlineRelations ? { cacheKeyPrefix: 'inline' } : undefined);
    },

    list: async <
      ThrowOnError extends boolean = DefaultThrowOnError,
      const ResolveRelationsStr extends string | undefined = undefined,
    >(
      options: { query?: Omit<NonNullable<ListData['query']>, 'resolve_relations'> & { resolve_relations?: ResolveRelationsStr }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<ListResponse<TComponents, InlineRelations, ResolveRelationsStr>, ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const typedQuery = (query ?? {}) as NonNullable<ListData['query']>;
      const requestPath = '/v2/cdn/stories';
      return requestWithCache('GET', requestPath, typedQuery, async (requestQuery: Record<string, unknown>) => {
        const response = await throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse(listStories({
            client,
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
          }))) satisfies ApiResponse<ListResponse<TComponents, InlineRelations, ResolveRelationsStr>, ThrowOnError>;

        if (!inlineRelations || response.data === undefined) {
          return response;
        }

        const storiesData = response.data as unknown as StoriesData;
        const resolved = await resolveRelationMap(storiesData, requestQuery, { client, throttleManager });
        if (!resolved) {
          return response;
        }

        return {
          ...response,
          data: {
            ...response.data,
            stories: inlineStoriesContent(storiesData.stories, resolved.relationPaths, resolved.relationMap),
          },
        };
      }, inlineRelations ? { cacheKeyPrefix: 'inline' } : undefined);
    },
  };
}

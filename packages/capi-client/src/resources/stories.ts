import { getStoryById, listStories } from "../generated/capi/sdk.gen";
import type {
  GetStoryByIdData,
  GetStoryByIdResponses,
  ListStoriesData,
  ListStoriesResponses,
} from "../generated/capi/types.gen";
import type {
  ApplyRestrictions,
  AssetFieldValue,
  BlockContent as BlokContent,
  FieldValue,
  HasRestriction,
  MultilinkFieldValue,
  PluginFieldValue,
  RestrictRichText,
  RichTextFieldValue,
  TableFieldValue,
} from "../generated/types/field";
import {
  inlineStoriesContent,
  inlineStoryContent,
  resolveRelationMap,
} from "../utils/inline-relations";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import type {
  BlockFields,
  Block as Component,
  RootBlock as RootComponents,
} from "../generated/types/block";
import type { Prettify } from "../generated/types/_utils";
import type { Story } from "../generated/types/story";
import { buildCallOptions } from "@storyblok/utils/http";

/**
 * Top-level story fields that can be excluded from CDN API responses via
 * the `excluding_story_fields` parameter. Fields not in this list are
 * silently ignored by the API.
 */
export type ExcludableStoryField =
  | "alternates"
  | "created_at"
  | "default_full_slug"
  | "first_published_at"
  | "group_id"
  | "is_startpage"
  | "lang"
  | "meta_data"
  | "parent_id"
  | "path"
  | "position"
  | "published_at"
  | "release_id"
  | "sort_by_date"
  | "tag_list"
  | "taxonomy_terms"
  | "translated_slugs"
  | "updated_at";

/**
 * Returns a spread-ready query fragment for `excluding_story_fields`:
 * - array with items  → `{ excluding_story_fields: "a,b,c" }`
 * - empty array / undefined → `{}` (param omitted)
 * - string → `{ excluding_story_fields: "a,b,c" }` (unchanged)
 */
function excludingStoryFieldsParam(
  value: ExcludableStoryField | ExcludableStoryField[] | undefined,
): { excluding_story_fields: string } | Record<never, never> {
  const str = Array.isArray(value) ? (value.length > 0 ? value.join(",") : undefined) : value;
  return str !== undefined ? { excluding_story_fields: str } : {};
}

type InlinedStoryContentField =
  | string
  | number
  | boolean
  | Array<string | AssetFieldValue | BlokContent | StoryWithInlinedRelations>
  | AssetFieldValue
  | MultilinkFieldValue
  | TableFieldValue
  | RichTextFieldValue
  | PluginFieldValue
  | StoryWithInlinedRelations
  | undefined;

interface InlinedStoryContent {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: InlinedStoryContentField;
}

export type StoryWithInlinedRelations = Omit<Story, "content"> & {
  content: InlinedStoryContent;
};

/** The characters `String.prototype.trim` strips, which the runtime applies to each path. */
type Whitespace =
  | " "
  | "\t"
  | "\n"
  | "\v"
  | "\f"
  | "\r"
  | "\u00A0"
  | "\u1680"
  | "\u2000"
  | "\u2001"
  | "\u2002"
  | "\u2003"
  | "\u2004"
  | "\u2005"
  | "\u2006"
  | "\u2007"
  | "\u2008"
  | "\u2009"
  | "\u200A"
  | "\u2028"
  | "\u2029"
  | "\u202F"
  | "\u205F"
  | "\u3000"
  | "\uFEFF";

type Trim<T extends string> = T extends `${Whitespace}${infer Rest}`
  ? Trim<Rest>
  : T extends `${infer Rest}${Whitespace}`
    ? Trim<Rest>
    : T;

/** The runtime decodes a URL-encoded `resolve_relations` before splitting it. */
type RelationPathSeparator = "," | "%2C" | "%2c";

/**
 * Splits `"comp.field, comp2.field2"` into the union `"comp.field" | "comp2.field2"`.
 * A non-literal `string` stays `string`, which matches every path.
 */
type ParseRelationPaths<
  T extends string,
  TPaths extends string = never,
> = T extends `${infer Path}${RelationPathSeparator}${infer Rest}`
  ? ParseRelationPaths<Rest, TPaths | Trim<Path>>
  : TPaths | Trim<T>;

/**
 * A related story. Only root blocks can be a story's content, and its content has the
 * same relation paths inlined.
 *
 * Uses a mapped type instead of a distributive conditional with a separate
 * full-blocks parameter, so the full `TBlocks` union survives when DTS bundlers (like
 * tsdown) inline the alias. A distributive conditional + default-parameter pattern
 * would collapse both parameters to the distributed single member. Each root block is
 * iterated as `K` while `TBlocks` stays the full union for nested blok fields, and the
 * final indexed access produces the discriminated union of all story types.
 */
type InlinedStory<TBlocks extends Component, TPaths extends string, TFieldPlugins> = {
  [K in RootComponents<TBlocks> as K["name"]]: Omit<Story<K, TFieldPlugins, TBlocks>, "content"> & {
    content: InlinedBlockContent<K, TBlocks, TPaths, TFieldPlugins>;
  };
}[RootComponents<TBlocks>["name"]];

/** A UUID the API returns no story for (e.g. unpublished or deleted) stays a string. */
type RelationValue<TValue, TStory> = TValue extends string
  ? TValue | TStory
  : TValue extends readonly (infer TItem)[]
    ? RelationValue<TItem, TStory>[]
    : TValue;

/**
 * A block embedded in a richtext field without `allow`. Its component is unknown, so
 * any of its fields can hold an inlined story.
 */
interface InlinedLooseBlockContent<TStory> {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]:
    | null
    | string
    | number
    | boolean
    | TStory
    | Array<string | TStory | AssetFieldValue | InlinedLooseBlockContent<TStory>>
    | AssetFieldValue
    | MultilinkFieldValue
    | TableFieldValue
    | RestrictRichText<RichTextFieldValue, InlinedLooseBlockContent<TStory>>
    | PluginFieldValue
    | undefined;
}

/**
 * The relation paths that can reach a block embedded in a richtext field without
 * `allow`: every path except those naming a block that is never nestable.
 */
type LooseBlockPaths<TPaths extends string, TBlocks extends Component> = Exclude<
  TPaths,
  `${Extract<TBlocks, { is_nestable: false }>["name"]}.${string}`
>;

type InlinedFieldValue<
  TField extends BlockFields[number],
  TBlockName extends string,
  TBlocks extends Component,
  TPaths extends string,
  TFieldPlugins,
> = TField extends { type: "bloks" }
  ? Prettify<
      InlinedBlockContent<ApplyRestrictions<TField, TBlocks>, TBlocks, TPaths, TFieldPlugins>[]
    >
  : TField extends { type: "richtext" }
    ? HasRestriction<TField> extends true
      ? Prettify<
          RestrictRichText<
            RichTextFieldValue,
            InlinedBlockContent<ApplyRestrictions<TField, TBlocks>, TBlocks, TPaths, TFieldPlugins>
          >
        >
      : [LooseBlockPaths<TPaths, TBlocks>] extends [never]
        ? FieldValue<TField, TBlocks, TFieldPlugins>
        : Prettify<
            RestrictRichText<
              RichTextFieldValue,
              InlinedLooseBlockContent<InlinedStory<TBlocks, TPaths, TFieldPlugins>>
            >
          >
    : `${TBlockName}.${TField["name"]}` extends TPaths
      ? RelationValue<
          FieldValue<TField, TBlocks, TFieldPlugins>,
          InlinedStory<TBlocks, TPaths, TFieldPlugins>
        >
      : FieldValue<TField, TBlocks, TFieldPlugins>;

/**
 * Block content with relations inlined, built from the block's field definitions
 * rather than by walking its content type, so fields that hold no relation keep their
 * types and large schemas stay within the compiler's instantiation limits.
 */
type InlinedBlockContent<
  TBlock extends Component,
  TBlocks extends Component,
  TPaths extends string,
  TFieldPlugins,
> = TBlock extends any
  ? Prettify<
      { _uid: string; component: TBlock["name"]; _editable?: string } & Prettify<
        {
          [F in TBlock["fields"][number] as F extends { required: true }
            ? F["name"]
            : never]: InlinedFieldValue<F, TBlock["name"], TBlocks, TPaths, TFieldPlugins>;
        } & {
          [F in TBlock["fields"][number] as F extends { required: true }
            ? never
            : F["name"]]?: InlinedFieldValue<
            F,
            TBlock["name"],
            TBlocks,
            TPaths,
            TFieldPlugins
          > | null;
        }
      >
    >
  : never;

/**
 * Types a block's content as returned by a client created with `inlineRelations: true`:
 * each relation field listed in `TResolveRelations` (the `resolve_relations` query
 * format, e.g. `"featured-articles.posts,article.author"`) becomes the related story,
 * or an array of them, at any nesting depth and inside related stories. A relation the
 * API returns no story for (e.g. unpublished or deleted) stays a UUID string, so each
 * value is `string | story`.
 *
 * `TBlock` is the block definition and `TBlocks` the union of all blocks in the space;
 * related stories are typed from its root blocks. Pass the same `TResolveRelations` as
 * the fetch: the content of a related story depends on every path, so a block fetched
 * with more paths does not match props declared with fewer. A non-literal
 * `TResolveRelations` (`string`) can match any field, so every string or string-array
 * field at any depth becomes `string | story`. Table cells are the exception: the
 * runtime can match them (`_table_col.value`), but they keep their string type.
 * `TFieldPlugins` types `custom` fields, as in {@link Story}.
 *
 * Related stories that reference each other resolve to the same object, so the
 * result can be circular and `JSON.stringify` throws on it.
 *
 * @example
 * // `featuredArticles` is a `defineBlock` result, `Blocks` the union of all blocks.
 * type Props = {
 *   block: WithInlinedRelations<typeof featuredArticles, "featured-articles.posts", Blocks>;
 * };
 */
export type WithInlinedRelations<
  TBlock extends Component,
  TResolveRelations extends string,
  TBlocks extends Component,
  TFieldPlugins = Record<never, never>,
> = InlinedBlockContent<TBlock, TBlocks, ParseRelationPaths<TResolveRelations>, TFieldPlugins>;

/**
 * Resolves to a narrowed component-derived story type when `TComponents` is a specific
 * Component union, or falls back to the generated Story / StoryWithInlinedRelations
 * when `TComponents` is the default Component base type (no type argument provided).
 *
 * With `inlineRelations: true` and `resolve_relations` (e.g. `"article.author"`), matched
 * fields can hold the related story at any depth (see {@link WithInlinedRelations}).
 * Without `inlineRelations`, relations stay UUIDs.
 */
type StoryResult<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
  TFieldPlugins = Record<never, never>,
> = Component extends TComponents
  ? InlineRelations extends true
    ? StoryWithInlinedRelations
    : Story // fallback
  : InlineRelations extends true
    ? ResolveRelationsRaw extends string
      ? InlinedStory<TComponents, ParseRelationPaths<ResolveRelationsRaw>, TFieldPlugins>
      : Story<TComponents, TFieldPlugins>
    : Story<TComponents, TFieldPlugins>;

type GetResponse<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
  TFieldPlugins = Record<never, never>,
> = Omit<GetStoryByIdResponses[200], "story"> & {
  story: StoryResult<TComponents, InlineRelations, ResolveRelationsRaw, TFieldPlugins>;
};
type ListResponse<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
  TFieldPlugins = Record<never, never>,
> = Omit<ListStoriesResponses[200], "stories"> & {
  stories: Array<StoryResult<TComponents, InlineRelations, ResolveRelationsRaw, TFieldPlugins>>;
};

/**
 * Internal relation-resolution shapes. The public response types expose the
 * generic `Story`, but relation inlining needs to read the API's sidecar
 * `rels`/`rel_uuids` fields off the raw payload. These three interfaces model
 * that wire shape so the `response.data` narrowing below stays in one place
 * instead of being scattered as inline casts.
 */
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

/** The story identifier path param (full slug, numeric ID, or UUID), derived from the generated request type. */
type StoryIdentifier = GetStoryByIdData["path"]["id"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoriesResourceDeps<
  DefaultThrowOnError extends boolean = false,
> extends ResourceDeps<DefaultThrowOnError> {
  inlineRelations: boolean;
}

export function createStoriesResource<
  TComponents extends Component = Component,
  TFieldPlugins = Record<never, never>,
  InlineRelations extends boolean = false,
  DefaultThrowOnError extends boolean = false,
>(deps: StoriesResourceDeps<DefaultThrowOnError>) {
  const { client, requestWithCache, asApiResponse, inlineRelations, throttleManager } = deps;

  return {
    get: async <
      ThrowOnError extends boolean = DefaultThrowOnError,
      const ResolveRelationsStr extends string | undefined = undefined,
    >(
      identifier: StoryIdentifier,
      options: {
        query?: Omit<
          NonNullable<GetStoryByIdData["query"]>,
          "resolve_relations" | "excluding_story_fields"
        > & {
          resolve_relations?: ResolveRelationsStr;
          excluding_story_fields?: ExcludableStoryField | ExcludableStoryField[];
        };
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<
      ApiResponse<
        GetResponse<TComponents, InlineRelations, ResolveRelationsStr, TFieldPlugins>,
        ThrowOnError
      >
    > => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const { excluding_story_fields, ...restQuery } = query;
      const normalizedQuery = {
        ...restQuery,
        ...excludingStoryFieldsParam(excluding_story_fields),
      };
      const typedQuery = normalizedQuery as NonNullable<GetStoryByIdData["query"]>;
      const resolvedQuery =
        typeof identifier === "string" && UUID_RE.test(identifier) && !typedQuery.find_by
          ? { ...typedQuery, find_by: "uuid" }
          : typedQuery;
      const requestPath = `/v2/cdn/stories/${identifier}`;
      return requestWithCache(
        "GET",
        requestPath,
        resolvedQuery,
        async (requestQuery: Record<string, unknown>) => {
          const response = (await throttleManager.execute(requestPath, requestQuery, () =>
            asApiResponse(
              getStoryById({
                client,
                path: { id: identifier },
                query: requestQuery,
                signal,
                ...buildCallOptions(client, throwOnError, fetchOptions),
              }),
            ),
          )) satisfies ApiResponse<
            GetResponse<TComponents, InlineRelations, ResolveRelationsStr, TFieldPlugins>,
            ThrowOnError
          >;

          if (!inlineRelations || response.data === undefined) {
            return response;
          }

          // Narrow to the internal relation shape to read the API's sidecar
          // `rels`/`rel_uuids`; consumers keep seeing the generic `Story`.
          const storyData = response.data as unknown as StoryData;
          const resolved = await resolveRelationMap(storyData, requestQuery, {
            client,
            throttleManager,
          });
          if (!resolved) {
            return response;
          }

          return {
            ...response,
            data: {
              ...response.data,
              story: inlineStoryContent(
                storyData.story,
                resolved.relationPaths,
                resolved.relationMap,
              ),
            },
          };
        },
        inlineRelations ? { cacheKeyPrefix: "inline" } : undefined,
      );
    },

    list: async <
      ThrowOnError extends boolean = DefaultThrowOnError,
      const ResolveRelationsStr extends string | undefined = undefined,
    >(
      options: {
        query?: Omit<
          NonNullable<ListStoriesData["query"]>,
          "resolve_relations" | "excluding_story_fields"
        > & {
          resolve_relations?: ResolveRelationsStr;
          excluding_story_fields?: ExcludableStoryField | ExcludableStoryField[];
        };
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<
      ApiResponse<
        ListResponse<TComponents, InlineRelations, ResolveRelationsStr, TFieldPlugins>,
        ThrowOnError
      >
    > => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const { excluding_story_fields, ...restQuery } = query;
      const normalizedQuery = {
        ...restQuery,
        ...excludingStoryFieldsParam(excluding_story_fields),
      };
      const typedQuery = normalizedQuery as NonNullable<ListStoriesData["query"]>;
      const requestPath = "/v2/cdn/stories";
      return requestWithCache(
        "GET",
        requestPath,
        typedQuery,
        async (requestQuery: Record<string, unknown>) => {
          const response = (await throttleManager.execute(requestPath, requestQuery, () =>
            asApiResponse(
              listStories({
                client,
                query: requestQuery,
                signal,
                ...buildCallOptions(client, throwOnError, fetchOptions),
              }),
            ),
          )) satisfies ApiResponse<
            ListResponse<TComponents, InlineRelations, ResolveRelationsStr, TFieldPlugins>,
            ThrowOnError
          >;

          if (!inlineRelations || response.data === undefined) {
            return response;
          }

          // Narrow to the internal relation shape to read the API's sidecar
          // `rels`/`rel_uuids`; consumers keep seeing the generic `Story`.
          const storiesData = response.data as unknown as StoriesData;
          const resolved = await resolveRelationMap(storiesData, requestQuery, {
            client,
            throttleManager,
          });
          if (!resolved) {
            return response;
          }

          return {
            ...response,
            data: {
              ...response.data,
              stories: inlineStoriesContent(
                storiesData.stories,
                resolved.relationPaths,
                resolved.relationMap,
              ),
            },
          };
        },
        inlineRelations ? { cacheKeyPrefix: "inline" } : undefined,
      );
    },
  };
}

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
  ContentField,
  FieldValue,
  HasRestriction,
  MultilinkFieldValue,
  PluginFieldValue,
  RestrictRichText,
  RichTextFieldValue,
  TableFieldValue,
} from "../generated/types/field";
import { addLinks, createLinkInliner, resolveLinkMap } from "../utils/inline-links";
import type {
  InlinedLink,
  InlinedLinkRichText,
  InlinedMultilinkValue,
  ResolveLinks,
  StoryLinkData,
} from "../utils/inline-links";
import { inlineStoriesContent, resolveRelationMap } from "../utils/inline-relations";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import { ClientError } from "../error";
import type {
  BlockFields,
  Block as Component,
  RootBlock as RootComponents,
} from "../generated/types/block";
import type { Prettify } from "../generated/types/_utils";
import type { Story } from "../generated/types/story";

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
type InlinedStory<
  TBlocks extends Component,
  TPaths extends string,
  TFieldPlugins,
  TLink = never,
> = {
  [K in RootComponents<TBlocks> as K["name"]]: Omit<Story<K, TFieldPlugins, TBlocks>, "content"> & {
    content: InlinedBlockContent<K, TBlocks, TPaths, TFieldPlugins, TLink>;
  };
}[RootComponents<TBlocks>["name"]];

/** A UUID the API returns no story for (e.g. unpublished or deleted) stays a string. */
type RelationValue<TValue, TStory> = TValue extends string
  ? TValue | TStory
  : TValue extends readonly (infer TItem)[]
    ? RelationValue<TItem, TStory>[]
    : TValue;

/**
 * A block whose component is unknown, e.g. one embedded in a rich text field without
 * `allow`, so any of its fields can hold an inlined story or link.
 */
interface InlinedLooseBlockContent<TStory, TLink = never> {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]:
    | null
    | string
    | number
    | boolean
    | TStory
    | Array<string | TStory | AssetFieldValue | InlinedLooseBlockContent<TStory, TLink>>
    | AssetFieldValue
    | InlinedMultilinkValue<TLink>
    | TableFieldValue
    | InlinedLinkRichText<
        RestrictRichText<RichTextFieldValue, InlinedLooseBlockContent<TStory, TLink>>,
        TLink
      >
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
  TLink,
> = TField extends { type: "bloks" }
  ? Prettify<
      InlinedBlockContent<
        ApplyRestrictions<TField, TBlocks>,
        TBlocks,
        TPaths,
        TFieldPlugins,
        TLink
      >[]
    >
  : TField extends { type: "richtext" }
    ? HasRestriction<TField> extends true
      ? Prettify<
          InlinedLinkRichText<
            RestrictRichText<
              RichTextFieldValue,
              InlinedBlockContent<
                ApplyRestrictions<TField, TBlocks>,
                TBlocks,
                TPaths,
                TFieldPlugins,
                TLink
              >
            >,
            TLink
          >
        >
      : [LooseBlockPaths<TPaths, TBlocks> | TLink] extends [never]
        ? FieldValue<TField, TBlocks, TFieldPlugins>
        : Prettify<
            InlinedLinkRichText<
              RestrictRichText<
                RichTextFieldValue,
                InlinedLooseBlockContent<
                  [LooseBlockPaths<TPaths, TBlocks>] extends [never]
                    ? never
                    : InlinedStory<TBlocks, TPaths, TFieldPlugins, TLink>,
                  TLink
                >
              >,
              TLink
            >
          >
    : TField extends { type: "multilink" }
      ? [TLink] extends [never]
        ? FieldValue<TField, TBlocks, TFieldPlugins>
        : InlinedMultilinkValue<TLink>
      : `${TBlockName}.${TField["name"]}` extends TPaths
        ? RelationValue<
            FieldValue<TField, TBlocks, TFieldPlugins>,
            InlinedStory<TBlocks, TPaths, TFieldPlugins, TLink>
          >
        : FieldValue<TField, TBlocks, TFieldPlugins>;

/**
 * Block content with relations and links inlined, built from the block's field
 * definitions rather than by walking its content type, so fields that hold no relation
 * or link keep their types and large schemas stay within the compiler's instantiation
 * limits. `TLink` is the resolved link type, `never` when links are not inlined.
 */
type InlinedBlockContent<
  TBlock extends Component,
  TBlocks extends Component,
  TPaths extends string,
  TFieldPlugins,
  TLink = never,
> = TBlock extends any
  ? Prettify<
      { _uid: string; component: TBlock["name"]; _editable?: string } & Prettify<
        {
          [F in ContentField<TBlock["fields"]> as F extends { required: true }
            ? F["name"]
            : never]: InlinedFieldValue<F, TBlock["name"], TBlocks, TPaths, TFieldPlugins, TLink>;
        } & {
          [F in ContentField<TBlock["fields"]> as F extends { required: true }
            ? never
            : F["name"]]?: InlinedFieldValue<
            F,
            TBlock["name"],
            TBlocks,
            TPaths,
            TFieldPlugins,
            TLink
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
 * `TFieldPlugins` types `custom` fields, as in {@link Story}. With `inlineLinks: true`
 * too, use {@link WithInlinedContent}.
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

/** What {@link WithInlinedContent} inlines: the fetch's query values and field plugins. */
export interface InlinedContentOptions {
  /** The `resolve_relations` value, with `inlineRelations: true`. */
  relations?: string;
  /** The `resolve_links` value, with `inlineLinks: true`. */
  links?: ResolveLinks;
  /** Types `custom` fields, as in {@link Story}. */
  fieldPlugins?: unknown;
}

type FieldPluginsOf<TOptions extends InlinedContentOptions> = TOptions extends {
  fieldPlugins: infer TFieldPlugins;
}
  ? TFieldPlugins
  : Record<never, never>;

/**
 * Types a block's content as returned by a client created with `inlineRelations: true`,
 * `inlineLinks: true`, or both, combining {@link WithInlinedRelations} and
 * {@link WithInlinedLinks}. Pass the fetch's values in `TOptions`.
 *
 * @example
 * type Props = {
 *   block: WithInlinedContent<typeof page, Blocks, { relations: "page.author"; links: "story" }>;
 * };
 */
export type WithInlinedContent<
  TBlock extends Component,
  TBlocks extends Component,
  TOptions extends InlinedContentOptions,
> = InlinedBlockContent<
  TBlock,
  TBlocks,
  TOptions extends { relations: infer TRelations extends string }
    ? ParseRelationPaths<TRelations>
    : never,
  FieldPluginsOf<TOptions>,
  ResolvedLink<
    TOptions extends { links: infer TLinks extends ResolveLinks } ? TLinks : never,
    TBlocks,
    FieldPluginsOf<TOptions>
  >
>;

/**
 * Types a block's content as returned by a client created with `inlineLinks: true`:
 * each story link, in multilink fields and rich text link marks at any depth, carries
 * the resolved link as `story` (see {@link InlinedLink}). A link the API resolves no
 * story for (e.g. unpublished or deleted) has no `story`.
 *
 * `TBlock` is the block definition and `TBlocks` the union of all blocks in the space;
 * linked stories are typed from its root blocks. `TResolveLinks` is the `resolve_links`
 * value of the fetch. With `inlineRelations` too, use {@link WithInlinedContent}.
 *
 * @example
 * type Props = {
 *   block: WithInlinedLinks<typeof teaser, "story", Blocks>;
 * };
 */
export type WithInlinedLinks<
  TBlock extends Component,
  TResolveLinks extends ResolveLinks,
  TBlocks extends Component,
  TFieldPlugins = Record<never, never>,
> = InlinedBlockContent<
  TBlock,
  TBlocks,
  never,
  TFieldPlugins,
  ResolvedLink<TResolveLinks, TBlocks, TFieldPlugins>
>;

/**
 * A linked story. With `resolve_links_level: 2`, its own story links carry their linked
 * story too, whose links are not inlined. Its relations stay UUIDs.
 */
type LinkedStory<TBlocks extends Component, TResolveLinks extends string, TFieldPlugins> = {
  [K in RootComponents<TBlocks> as K["name"]]: Omit<Story<K, TFieldPlugins, TBlocks>, "content"> & {
    content: InlinedBlockContent<
      K,
      TBlocks,
      never,
      TFieldPlugins,
      InlinedLink<TResolveLinks, Story<TBlocks, TFieldPlugins>>
    >;
  };
}[RootComponents<TBlocks>["name"]];

/** A linked story without schema types, as {@link LinkedStory}. */
type LooseLinkedStory<TResolveLinks extends string> = Omit<Story, "content"> & {
  content: InlinedLooseBlockContent<never, InlinedLink<TResolveLinks, Story>>;
};

/**
 * The resolved link type for `TResolveLinks`, `never` without it. Linked stories are
 * typed from `TBlocks`, or loosely when it is the base `Component`.
 */
type ResolvedLink<TResolveLinks extends string, TBlocks extends Component, TFieldPlugins> = [
  TResolveLinks,
] extends [never]
  ? never
  : Component extends TBlocks
    ? InlinedLink<TResolveLinks, LooseLinkedStory<TResolveLinks>>
    : InlinedLink<TResolveLinks, LinkedStory<TBlocks, TResolveLinks, TFieldPlugins>>;

/** The relation paths a request inlines, `never` when it inlines none. */
type RequestRelationPaths<
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined,
> = InlineRelations extends true
  ? ResolveRelationsRaw extends string
    ? ParseRelationPaths<ResolveRelationsRaw>
    : never
  : never;

/** The resolved link type a request inlines, `never` when it inlines none. */
type RequestLink<
  InlineLinks extends boolean,
  ResolveLinksRaw extends string | undefined,
  TComponents extends Component,
  TFieldPlugins,
> = InlineLinks extends true
  ? ResolveLinksRaw extends string
    ? ResolvedLink<ResolveLinksRaw, TComponents, TFieldPlugins>
    : never
  : never;

/**
 * A story without schema types, as returned by a client created with
 * `inlineLinks: true`: each story link carries the resolved link as `story`.
 */
export type StoryWithInlinedLinks<TResolveLinks extends ResolveLinks = ResolveLinks> =
  LooseStoryWithInlinedLinks<ResolvedLink<TResolveLinks, Component, never>, false>;

/**
 * A story without schema types whose links are inlined, and whose relations are
 * inlined too when `InlineRelations` is `true`.
 */
type LooseStoryWithInlinedLinks<TLink, InlineRelations extends boolean> = Omit<Story, "content"> & {
  content: InlinedLooseBlockContent<
    InlineRelations extends true ? LooseStoryWithInlinedLinks<TLink, InlineRelations> : never,
    TLink
  >;
};

/**
 * Resolves to a narrowed component-derived story type when `TComponents` is a specific
 * Component union, or falls back to the generated Story / StoryWithInlinedRelations
 * when `TComponents` is the default Component base type (no type argument provided).
 *
 * With `inlineRelations: true` and `resolve_relations` (e.g. `"article.author"`), matched
 * fields can hold the related story at any depth (see {@link WithInlinedRelations}).
 * Without `inlineRelations`, relations stay UUIDs. With `inlineLinks: true` and
 * `resolve_links`, story links carry the resolved link (see {@link WithInlinedLinks}).
 */
type StoryResult<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
  TFieldPlugins = Record<never, never>,
  InlineLinks extends boolean = false,
  ResolveLinksRaw extends string | undefined = undefined,
> =
  // Distributes over the flags, so a client configured with `boolean` gets every variant.
  InlineRelations extends unknown
    ? InlineLinks extends unknown
      ? StoryResultFor<
          TComponents,
          InlineRelations,
          ResolveRelationsRaw,
          TFieldPlugins,
          InlineLinks,
          ResolveLinksRaw
        >
      : never
    : never;

type StoryResultFor<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined,
  TFieldPlugins,
  InlineLinks extends boolean,
  ResolveLinksRaw extends string | undefined,
> = Component extends TComponents
  ? [RequestLink<InlineLinks, ResolveLinksRaw, TComponents, TFieldPlugins>] extends [never]
    ? InlineRelations extends true
      ? StoryWithInlinedRelations
      : Story // fallback
    : LooseStoryWithInlinedLinks<
        RequestLink<InlineLinks, ResolveLinksRaw, TComponents, TFieldPlugins>,
        InlineRelations
      >
  : [
        | RequestRelationPaths<InlineRelations, ResolveRelationsRaw>
        | RequestLink<InlineLinks, ResolveLinksRaw, TComponents, TFieldPlugins>,
      ] extends [never]
    ? Story<TComponents, TFieldPlugins>
    : InlinedStory<
        TComponents,
        RequestRelationPaths<InlineRelations, ResolveRelationsRaw>,
        TFieldPlugins,
        RequestLink<InlineLinks, ResolveLinksRaw, TComponents, TFieldPlugins>
      >;

type GetResponse<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
  TFieldPlugins = Record<never, never>,
  InlineLinks extends boolean = false,
  ResolveLinksRaw extends string | undefined = undefined,
> = Omit<GetStoryByIdResponses[200], "story"> & {
  story: StoryResult<
    TComponents,
    InlineRelations,
    ResolveRelationsRaw,
    TFieldPlugins,
    InlineLinks,
    ResolveLinksRaw
  >;
};
type ListResponse<
  TComponents extends Component,
  InlineRelations extends boolean,
  ResolveRelationsRaw extends string | undefined = undefined,
  TFieldPlugins = Record<never, never>,
  InlineLinks extends boolean = false,
  ResolveLinksRaw extends string | undefined = undefined,
> = Omit<ListStoriesResponses[200], "stories"> & {
  stories: Array<
    StoryResult<
      TComponents,
      InlineRelations,
      ResolveRelationsRaw,
      TFieldPlugins,
      InlineLinks,
      ResolveLinksRaw
    >
  >;
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

interface StoryData extends StoryRelationData, StoryLinkData {
  story: Story;
}

interface StoriesData extends StoryRelationData, StoryLinkData {
  stories: Story[];
}

/** The story identifier path param (full slug, numeric ID, or UUID), derived from the generated request type. */
type StoryIdentifier = GetStoryByIdData["path"]["id"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoriesResourceDeps<
  DefaultThrowOnError extends boolean = false,
> extends ResourceDeps<DefaultThrowOnError> {
  inlineRelations: boolean;
  inlineLinks?: boolean;
}

export function createStoriesResource<
  TComponents extends Component = Component,
  TFieldPlugins = Record<never, never>,
  InlineRelations extends boolean = false,
  DefaultThrowOnError extends boolean = false,
  InlineLinks extends boolean = false,
>(deps: StoriesResourceDeps<DefaultThrowOnError>) {
  const {
    client,
    requestWithCache,
    asApiResponse,
    inlineRelations,
    inlineLinks: shouldInlineLinks = false,
    throttleManager,
  } = deps;

  /**
   * Inlined responses are cached apart from raw ones. Relations keep their `inline` prefix, so
   * entries cached before link inlining existed stay valid.
   */
  const getCacheOptions = (query: { resolve_links?: unknown }) => {
    const cacheKeyPrefix =
      [inlineRelations && "inline", shouldInlineLinks && query.resolve_links && "links"]
        .filter(Boolean)
        .join("-") || undefined;
    return cacheKeyPrefix ? { cacheKeyPrefix } : undefined;
  };

  const inlineStories = async (
    stories: Story[],
    data: StoryRelationData & StoryLinkData,
    requestQuery: Record<string, unknown>,
    signal: AbortSignal | undefined,
  ): Promise<Story[]> => {
    const [resolvedRelations, resolvedLinks] = await Promise.all([
      inlineRelations
        ? resolveRelationMap(data, requestQuery, { client, throttleManager, signal })
        : null,
      shouldInlineLinks
        ? resolveLinkMap(data, requestQuery, { client, throttleManager, signal })
        : null,
    ]);

    let relationMap = resolvedRelations?.relationMap;
    if (resolvedLinks) {
      const { linkMap, depth } = resolvedLinks;
      if (resolvedRelations && Number(requestQuery.resolve_links_in_relations) === 1) {
        addLinks(linkMap, resolvedRelations.links);
      }
      const inlineLinks = createLinkInliner(linkMap, depth);
      stories.forEach(inlineLinks);
      // Related stories get their links before they are copied into the content. They are
      // copied first, so the response's `rels` stay unchanged.
      relationMap =
        relationMap &&
        new Map(
          [...relationMap].map(([uuid, story]) => [uuid, inlineLinks(structuredClone(story))]),
        );
    }

    return resolvedRelations && relationMap
      ? inlineStoriesContent(stories, resolvedRelations.relationPaths, relationMap)
      : stories;
  };

  /**
   * A failed follow-up request (e.g. for `rel_uuids`) fails the whole call, as an error result
   * unless `throwOnError` is set.
   */
  const shouldThrow = (throwOnError: boolean | undefined) =>
    throwOnError ?? client.getConfig().throwOnError ?? false;

  return {
    get: async <
      ThrowOnError extends boolean = DefaultThrowOnError,
      const ResolveRelationsStr extends string | undefined = undefined,
      const ResolveLinksStr extends ResolveLinks | undefined = undefined,
    >(
      identifier: StoryIdentifier,
      options: {
        query?: Omit<
          NonNullable<GetStoryByIdData["query"]>,
          "resolve_relations" | "resolve_links" | "excluding_story_fields"
        > & {
          resolve_relations?: ResolveRelationsStr;
          resolve_links?: ResolveLinksStr;
          excluding_story_fields?: ExcludableStoryField | ExcludableStoryField[];
        };
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<
      ApiResponse<
        GetResponse<
          TComponents,
          InlineRelations,
          ResolveRelationsStr,
          TFieldPlugins,
          InlineLinks,
          ResolveLinksStr
        >,
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
      const cacheOptions = getCacheOptions(resolvedQuery);
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
                ...(throwOnError === undefined ? {} : { throwOnError }),
                ...(fetchOptions
                  ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
                  : {}),
              }),
            ),
          )) satisfies ApiResponse<
            GetResponse<
              TComponents,
              InlineRelations,
              ResolveRelationsStr,
              TFieldPlugins,
              InlineLinks,
              ResolveLinksStr
            >,
            ThrowOnError
          >;

          if (!cacheOptions || response.data === undefined) {
            return response;
          }

          // Narrow to the internal shape to read the API's sidecar `rels`/`rel_uuids`
          // and `links`/`link_uuids`; consumers keep seeing the generic `Story`.
          const storyData = response.data as unknown as StoryData;
          try {
            const [story] = await inlineStories([storyData.story], storyData, requestQuery, signal);
            return { ...response, data: { ...response.data, story } };
          } catch (error) {
            if (shouldThrow(throwOnError) || !(error instanceof ClientError)) {
              throw error;
            }
            // Only reached without `throwOnError`, where `data` is optional.
            return { ...response, data: undefined, error } as typeof response;
          }
        },
        cacheOptions,
      );
    },

    list: async <
      ThrowOnError extends boolean = DefaultThrowOnError,
      const ResolveRelationsStr extends string | undefined = undefined,
      const ResolveLinksStr extends ResolveLinks | undefined = undefined,
    >(
      options: {
        query?: Omit<
          NonNullable<ListStoriesData["query"]>,
          "resolve_relations" | "resolve_links" | "excluding_story_fields"
        > & {
          resolve_relations?: ResolveRelationsStr;
          resolve_links?: ResolveLinksStr;
          excluding_story_fields?: ExcludableStoryField | ExcludableStoryField[];
        };
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<
      ApiResponse<
        ListResponse<
          TComponents,
          InlineRelations,
          ResolveRelationsStr,
          TFieldPlugins,
          InlineLinks,
          ResolveLinksStr
        >,
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
      const cacheOptions = getCacheOptions(typedQuery);
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
                ...(throwOnError === undefined ? {} : { throwOnError }),
                ...(fetchOptions
                  ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
                  : {}),
              }),
            ),
          )) satisfies ApiResponse<
            ListResponse<
              TComponents,
              InlineRelations,
              ResolveRelationsStr,
              TFieldPlugins,
              InlineLinks,
              ResolveLinksStr
            >,
            ThrowOnError
          >;

          if (!cacheOptions || response.data === undefined) {
            return response;
          }

          // Narrow to the internal shape to read the API's sidecar `rels`/`rel_uuids`
          // and `links`/`link_uuids`; consumers keep seeing the generic `Story`.
          const storiesData = response.data as unknown as StoriesData;
          try {
            const stories = await inlineStories(
              storiesData.stories,
              storiesData,
              requestQuery,
              signal,
            );
            return { ...response, data: { ...response.data, stories } };
          } catch (error) {
            if (shouldThrow(throwOnError) || !(error instanceof ClientError)) {
              throw error;
            }
            // Only reached without `throwOnError`, where `data` is optional.
            return { ...response, data: undefined, error } as typeof response;
          }
        },
        cacheOptions,
      );
    },
  };
}

import type { Client } from "../generated/capi/client";
import type {
  LinkWithFullSlug,
  ListStoriesData,
  ResolvedLinkUrl,
} from "../generated/capi/types.gen";
import type { MultilinkFieldValue, RichTextFieldValue } from "../generated/types/field";
import type { Prettify } from "../generated/types/_utils";
import type { Story } from "../generated/types/story";
import { fetchMissingRelations } from "./fetch-rel-uuids";
import type { ThrottleManager } from "./rate-limit";

/** The values of the `resolve_links` query parameter. */
export type ResolveLinks = NonNullable<NonNullable<ListStoriesData["query"]>["resolve_links"]>;

/**
 * A resolved link, as set on `story` of the links pointing to it. `resolve_links: "story"`
 * resolves to the full story, `"url"` and `"link"` to a reduced object. Links beyond the
 * API's resolve limit are fetched as full stories in every mode, so `"url"` and `"link"`
 * can also hold a story.
 *
 * `TStory` is the story type, e.g. `Story<Blocks>` for schema-typed content.
 */
export type InlinedLink<TResolveLinks extends string = ResolveLinks, TStory = Story> =
  | TStory
  | (string extends TResolveLinks
      ? ResolvedLinkUrl | LinkWithFullSlug
      :
          | (TResolveLinks extends "url" ? ResolvedLinkUrl : never)
          | (TResolveLinks extends "link" ? LinkWithFullSlug : never));

type WithoutIndexSignature<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

type StoryMultilinkValue = Extract<MultilinkFieldValue, { linktype: "story" }>;

/**
 * A multilink field value whose story link carries the resolved link as `story`. A link
 * the API resolves no story for (e.g. unpublished or deleted) has no `story`.
 */
export type InlinedMultilinkValue<TLink> = [TLink] extends [never]
  ? MultilinkFieldValue
  :
      | Exclude<MultilinkFieldValue, { linktype: "story" }>
      | Prettify<
          WithoutIndexSignature<StoryMultilinkValue> & {
            story?: TLink;
            [key: string]: string | null | TLink | undefined;
          }
        >;

type InlinedLinkMark<TMark, TLink> = TMark extends { type: "link"; attrs: infer TAttrs }
  ? Omit<TMark, "attrs"> & { attrs: TAttrs & { story?: TLink } }
  : TMark;

/** Rebuilds each node around marks with inlined links, recursing through child nodes. */
type InlinedLinkNode<TNode, TLink> = TNode extends { content?: infer TChildren }
  ? TChildren extends readonly (infer TChild)[]
    ? InlinedNodeMarks<
        Omit<TNode, "content"> & { content?: InlinedLinkNode<TChild, TLink>[] },
        TLink
      >
    : InlinedNodeMarks<TNode, TLink>
  : InlinedNodeMarks<TNode, TLink>;

type InlinedNodeMarks<TNode, TLink> = TNode extends { marks?: infer TMarks }
  ? TMarks extends readonly (infer TMark)[]
    ? Omit<TNode, "marks"> & { marks?: InlinedLinkMark<TMark, TLink>[] }
    : TNode
  : TNode;

/**
 * A richtext document whose story link marks carry the resolved link as `attrs.story`.
 * Embedded blok bodies are left as they are, so they can be typed separately.
 */
export type InlinedLinkRichText<TDoc = RichTextFieldValue, TLink = InlinedLink> = [TLink] extends [
  never,
]
  ? TDoc
  : TDoc extends { content: readonly (infer TNode)[] }
    ? Omit<TDoc, "content"> & { content: InlinedLinkNode<TNode, TLink>[] }
    : TDoc;

export interface StoryLinkData {
  links?: InlinedLink[];
  link_uuids?: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Returns the UUID of the story a link points to: a multilink field stores it in `id`,
 * a richtext link mark's `attrs` in `uuid`.
 */
const getLinkedStoryUuid = (node: Record<string, unknown>): unknown =>
  node.fieldtype === "multilink" ? node.id : node.uuid;

export interface InlineLinksOptions {
  /**
   * Whether a link back to a linked story that is still being inlined gets that story
   * as `story`, making the result circular. Otherwise it gets no `story`.
   * @default false
   */
  circularReferences?: boolean;
}

/**
 * Creates a function that returns a copy of a story whose story links (multilink fields
 * and richtext link marks) carry their entry of `linkMap` as `story`, at any depth and
 * inside linked stories. Each linked story is copied once and shared by every link to
 * it.
 */
export const createLinkInliner = (
  linkMap: ReadonlyMap<string, InlinedLink>,
  { circularReferences = false }: InlineLinksOptions = {},
) => {
  const inlinedLinks = new Map<string, InlinedLink>();
  const linksInProgress = new Set<string>();

  const inlineLink = (uuid: string): InlinedLink | undefined => {
    const inlinedLink = inlinedLinks.get(uuid);
    if (inlinedLink && (circularReferences || !linksInProgress.has(uuid))) {
      return inlinedLink;
    }

    const link = linkMap.get(uuid);
    if (!link || linksInProgress.has(uuid)) {
      return undefined;
    }

    const clonedLink = structuredClone(link);
    inlinedLinks.set(uuid, clonedLink);
    linksInProgress.add(uuid);
    if ("content" in clonedLink) {
      inlineValue(clonedLink.content);
    }
    linksInProgress.delete(uuid);
    return clonedLink;
  };

  const inlineValue = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        inlineValue(item);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const child of Object.values(value)) {
      inlineValue(child);
    }

    if (value.linktype === "story") {
      const uuid = getLinkedStoryUuid(value);
      const link = typeof uuid === "string" ? inlineLink(uuid) : undefined;
      if (link) {
        value.story = link;
      }
    }
  };

  return <TStory extends { content: unknown }>(story: TStory): TStory => {
    const clonedStory = structuredClone(story);
    inlineValue(clonedStory.content);
    return clonedStory;
  };
};

interface ResolveLinkMapOptions {
  client: Client;
  throttleManager: ThrottleManager;
}

/**
 * Builds a map of resolved links from the response's `links`, fetching the stories
 * referenced by `link_uuids`, which the API returns instead when there are more links
 * than it resolves.
 *
 * Returns `null` when there is nothing to inline (no `resolve_links` in the query).
 */
export const resolveLinkMap = async (
  responseData: StoryLinkData,
  requestQuery: Record<string, unknown>,
  { client, throttleManager }: ResolveLinkMapOptions,
): Promise<Map<string, InlinedLink> | null> => {
  if (typeof requestQuery.resolve_links !== "string") {
    return null;
  }

  const linkMap = new Map<string, InlinedLink>();
  for (const link of responseData.links ?? []) {
    linkMap.set(link.uuid, link);
  }

  const missingUuids = (responseData.link_uuids ?? []).filter((uuid) => !linkMap.has(uuid));
  if (missingUuids.length > 0) {
    const fetchedLinks = await fetchMissingRelations({
      client,
      uuids: missingUuids,
      baseQuery: requestQuery,
      throttleManager,
    });
    for (const story of fetchedLinks) {
      linkMap.set(story.uuid, story);
    }
  }

  return linkMap.size > 0 ? linkMap : null;
};

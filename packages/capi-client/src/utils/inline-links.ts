import type { Client } from "../generated/capi/client";
import type {
  LinkWithFullSlug,
  ListStoriesData,
  ListStoriesResponses,
  ResolvedLinkUrl,
} from "../generated/capi/types.gen";
import type { MultilinkFieldValue, RichTextFieldValue } from "../generated/types/field";
import type { Prettify } from "../generated/types/_utils";
import type { Story } from "../generated/types/story";
import { fetchStoriesByUuids } from "./fetch-stories-by-uuids";
import { isRecord } from "./is-record";
import type { ThrottleManager } from "./rate-limit";

export type ResolveLinks = NonNullable<NonNullable<ListStoriesData["query"]>["resolve_links"]>;

/**
 * A resolved link, as set on `story` of the links pointing to it. `resolve_links: "story"`
 * resolves to the full story, `"url"` and `"link"` to a reduced object. In `"link"` mode, links
 * beyond the API's resolve limit are fetched as full stories.
 *
 * `TStory` is the story type, e.g. `Story<Blocks>` for schema-typed content.
 */
export type InlinedLink<
  TResolveLinks extends string = ResolveLinks,
  TStory = Story,
> = string extends TResolveLinks
  ? TStory | ResolvedLinkUrl | LinkWithFullSlug
  :
      | (TResolveLinks extends "story" ? TStory : never)
      | (TResolveLinks extends "url" ? ResolvedLinkUrl : never)
      | (TResolveLinks extends "link" ? LinkWithFullSlug | TStory : never);

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
 * A rich text document whose story link marks carry the resolved link as `attrs.story`.
 * Embedded block bodies are left as they are, so they can be typed separately.
 */
export type InlinedLinkRichText<TDoc = RichTextFieldValue, TLink = InlinedLink> = [TLink] extends [
  never,
]
  ? TDoc
  : TDoc extends { content: readonly (infer TNode)[] }
    ? Omit<TDoc, "content"> & { content: InlinedLinkNode<TNode, TLink>[] }
    : TDoc;

/** An entry of a response's `links`. */
type ResponseLink = NonNullable<ListStoriesResponses[200]["links"]>[number];

export interface StoryLinkData {
  links?: ResponseLink[];
  link_uuids?: string[];
}

/** Whether `node` is a multilink value or rich text link mark `attrs` that links a story. */
export const isStoryLink = (node: Record<string, unknown>): boolean => node.linktype === "story";

/**
 * Returns the UUID of the story a link points to: a multilink field stores it in `id`,
 * a rich text link mark's `attrs` in `uuid`.
 */
const getLinkedStoryUuid = (node: Record<string, unknown>): unknown =>
  node.fieldtype === "multilink" ? node.id : node.uuid;

const MAX_RESOLVE_LINKS_LEVEL = 2;

/**
 * How many levels of links to inline: the requested stories' links, and with
 * `resolve_links_level: 2` also the links of the linked stories, like the API resolves them.
 */
const getLinkDepth = (requestQuery: Record<string, unknown>): number =>
  Number(requestQuery.resolve_links_level) === MAX_RESOLVE_LINKS_LEVEL
    ? MAX_RESOLVE_LINKS_LEVEL
    : 1;

/**
 * Creates a function that sets `story` on each story link (multilink fields and rich text link
 * marks) in a story's content to its entry of `linkMap`, `depth` levels deep. Each linked story
 * is copied once per level and shared by the links to it. A level only links to the next one,
 * so the result is never circular.
 */
export const createLinkInliner = (linkMap: ReadonlyMap<string, ResponseLink>, depth: number) => {
  const copiesByLevel = Array.from({ length: depth }, () => new Map<string, ResponseLink>());

  const inlineLink = (uuid: string, level: number): ResponseLink | undefined => {
    const copies = copiesByLevel[level];
    const existingCopy = copies?.get(uuid);
    if (!copies || existingCopy) {
      return existingCopy;
    }

    const link = linkMap.get(uuid);
    if (!link) {
      return undefined;
    }

    const copy = structuredClone(link);
    copies.set(uuid, copy);
    if ("content" in copy) {
      inlineValue(copy.content, level + 1);
    }
    return copy;
  };

  const inlineValue = (value: unknown, level: number): void => {
    if (level >= depth) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        inlineValue(item, level);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const child of Object.values(value)) {
      inlineValue(child, level);
    }

    if (isStoryLink(value)) {
      const uuid = getLinkedStoryUuid(value);
      const link = typeof uuid === "string" ? inlineLink(uuid, level) : undefined;
      if (link) {
        value.story = link;
      }
    }
  };

  /** Mutates `story`. */
  return <TStory extends { content: unknown }>(story: TStory): TStory => {
    inlineValue(story.content, 0);
    return story;
  };
};

/** Reduces a story to the entry `resolve_links: "url"` returns for it. */
const toResolvedLinkUrl = (story: Story): ResolvedLinkUrl => ({
  id: story.id,
  uuid: story.uuid,
  name: story.name,
  slug: story.slug,
  full_slug: story.full_slug,
  url: story.path || story.full_slug,
});

interface ResolveLinkMapOptions {
  client: Client;
  throttleManager: ThrottleManager;
  signal?: AbortSignal;
}

export interface ResolvedLinks {
  linkMap: Map<string, ResponseLink>;
  depth: number;
}

/** Adds `links` that aren't in `linkMap` yet. */
export const addLinks = (linkMap: Map<string, ResponseLink>, links: readonly ResponseLink[]) => {
  for (const link of links) {
    if (!linkMap.has(link.uuid)) {
      linkMap.set(link.uuid, link);
    }
  }
};

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
  { client, throttleManager, signal }: ResolveLinkMapOptions,
): Promise<ResolvedLinks | null> => {
  if (typeof requestQuery.resolve_links !== "string") {
    return null;
  }

  const linkMap = new Map<string, ResponseLink>();
  addLinks(linkMap, responseData.links ?? []);

  const missingUuids = (responseData.link_uuids ?? []).filter((uuid) => !linkMap.has(uuid));
  if (missingUuids.length > 0) {
    const fetched = await fetchStoriesByUuids({
      client,
      uuids: missingUuids,
      baseQuery: requestQuery,
      throttleManager,
      signal,
    });
    addLinks(
      linkMap,
      requestQuery.resolve_links === "url"
        ? fetched.stories.map(toResolvedLinkUrl)
        : fetched.stories,
    );
    // The links of the fetched stories, for `resolve_links_level: 2`.
    addLinks(linkMap, fetched.links);
  }

  return { linkMap, depth: getLinkDepth(requestQuery) };
};

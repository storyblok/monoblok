import type { Client } from "../generated/capi/client";
import type { ListStoriesResponses } from "../generated/capi/types.gen";
import { fetchMissingRelations } from "./fetch-rel-uuids";
import type { ThrottleManager } from "./rate-limit";

/** An entry of the `links` array, which depends on the `resolve_links` value. */
export type InlinedLink = NonNullable<ListStoriesResponses[200]["links"]>[number];

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

/**
 * Sets `story` on every story link (multilink field or richtext link mark) in `value`
 * whose story is in `linkMap`. Mutates `value` in place.
 */
export const inlineLinks = (value: unknown, linkMap: ReadonlyMap<string, InlinedLink>): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      inlineLinks(item, linkMap);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const child of Object.values(value)) {
    inlineLinks(child, linkMap);
  }

  if (value.linktype === "story") {
    const uuid = getLinkedStoryUuid(value);
    const link = typeof uuid === "string" ? linkMap.get(uuid) : undefined;
    if (link) {
      value.story = link;
    }
  }
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

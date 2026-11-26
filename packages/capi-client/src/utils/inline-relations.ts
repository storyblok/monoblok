import type { Client } from "../generated/capi/client";
import type { Story } from "../generated/types/story";
import type { StoryWithInlinedRelations } from "../resources/stories";
import { fetchStoriesByUuids } from "./fetch-stories-by-uuids";
import type { StoriesByUuids } from "./fetch-stories-by-uuids";
import { isStoryLink } from "./inline-links";
import { isRecord } from "./is-record";
import type { ThrottleManager } from "./rate-limit";

type RelationPath = `${string}.${string}`;

interface ComponentNode {
  _uid: string;
  component: string;
  [key: string]: unknown;
}

const isComponentNode = (value: Record<string, unknown>): value is ComponentNode =>
  typeof value.component === "string" && typeof value._uid === "string";

/**
 * Decodes a string if it appears to be URL-encoded.
 * Detects common encoded characters (%2C for comma, %20 for space, etc.)
 */
const decodeIfEncoded = (value: string): string => {
  // Check if the string contains URL-encoded characters (% followed by hex digits)
  if (/%[0-9A-F]{2}/i.test(value)) {
    try {
      return decodeURIComponent(value);
    } catch {
      // If decoding fails (malformed encoding), return original
      return value;
    }
  }
  return value;
};

/**
 * Related stories are inlined up to two levels below a requested story, as in
 * `storyblok-js-client`. Relations below that stay UUID strings, so the result is never
 * circular. The CDN only puts two levels into `rels`; going deeper would cost extra requests.
 */
const MAX_RELATION_DEPTH = 2;

interface InlineContext<TStory> {
  relationPaths: ReadonlySet<RelationPath>;
  relationMap: ReadonlyMap<string, TStory>;
  /**
   * One copy per level and UUID. A story only references copies one level deeper, so the
   * result is never circular.
   */
  copies: Map<string, TStory>;
}

const createInlineContext = <TStory>(
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
): InlineContext<TStory> => ({
  relationPaths: new Set(relationPaths),
  relationMap,
  copies: new Map(),
});

const inlineStory = <TStory extends Story | StoryWithInlinedRelations>(
  story: TStory,
  depth: number,
  context: InlineContext<TStory>,
): TStory => {
  const copyKey = `${depth}:${story.uuid}`;
  const existingCopy = context.copies.get(copyKey);
  if (existingCopy) {
    return existingCopy;
  }

  const clonedStory = structuredClone(story);
  context.copies.set(copyKey, clonedStory);
  if (depth >= MAX_RELATION_DEPTH) {
    return clonedStory;
  }

  // resolveNode returns `unknown` to handle arbitrary JSON trees; shape is preserved at runtime.
  clonedStory.content = resolveNode(clonedStory.content, depth, context) as Story["content"];
  return clonedStory;
};

function resolveNode<TStory extends Story | StoryWithInlinedRelations>(
  value: unknown,
  depth: number,
  context: InlineContext<TStory>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveNode(item, depth, context));
  }

  if (!isRecord(value)) {
    return value;
  }

  if (isComponentNode(value)) {
    for (const [fieldName, fieldValue] of Object.entries(value)) {
      if (fieldName === "component" || fieldName === "_uid" || fieldName === "_editable") {
        continue;
      }

      const relationPath: RelationPath = `${value.component}.${fieldName}`;
      value[fieldName] = context.relationPaths.has(relationPath)
        ? resolveFieldValue(fieldValue, depth, context)
        : resolveNode(fieldValue, depth, context);
    }

    return value;
  }

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    // The API doesn't resolve the relations of a linked story, so they stay UUIDs.
    if (fieldName === "story" && isStoryLink(value)) {
      continue;
    }
    value[fieldName] = resolveNode(fieldValue, depth, context);
  }

  return value;
}

export const parseResolveRelations = (query: Record<string, unknown>): RelationPath[] => {
  if (typeof query.resolve_relations !== "string") {
    return [];
  }

  // Decode URL-encoded strings to handle pre-encoded input
  const resolveRelations = decodeIfEncoded(query.resolve_relations);

  return resolveRelations
    .split(",")
    .map((path) => path.trim())
    .filter((path): path is RelationPath => {
      const [component = "", field = "", ...rest] = path.split(".");
      return component.length > 0 && field.length > 0 && rest.length === 0;
    });
};

export const buildRelationMap = (rels: Array<Story> | undefined): Map<string, Story> => {
  const relationMap = new Map<string, Story>();

  for (const story of rels ?? []) {
    relationMap.set(story.uuid, story);
  }

  return relationMap;
};

function resolveFieldValue<TStory extends Story | StoryWithInlinedRelations>(
  value: unknown,
  depth: number,
  context: InlineContext<TStory>,
): unknown {
  if (typeof value === "string") {
    const relatedStory = context.relationMap.get(value);
    if (!relatedStory) {
      return value;
    }

    return inlineStory(relatedStory, depth + 1, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveFieldValue(item, depth, context));
  }

  return resolveNode(value, depth, context);
}

export const inlineStoriesContent = <TStory extends Story | StoryWithInlinedRelations>(
  stories: Array<TStory>,
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
): Array<TStory> => {
  const context = createInlineContext(relationPaths, relationMap);
  return stories.map((story) => inlineStory(story, 0, context));
};

interface ResolveRelationMapOptions {
  client: Client;
  throttleManager: ThrottleManager;
  signal?: AbortSignal;
}

export interface ResolvedRelations {
  relationPaths: RelationPath[];
  relationMap: Map<string, Story>;
  /** The links the API resolved in the relations fetched from `rel_uuids`. */
  links: StoriesByUuids["links"];
}

/**
 * Parses relation paths from the request query, builds a relation map from the
 * response's `rels`, and fetches any additional relations referenced by `rel_uuids`.
 *
 * Returns `null` when there is nothing to inline (no `resolve_relations` in the query).
 */
export const resolveRelationMap = async (
  responseData: { rels?: Story[]; rel_uuids?: string[] },
  requestQuery: Record<string, unknown>,
  { client, throttleManager, signal }: ResolveRelationMapOptions,
): Promise<ResolvedRelations | null> => {
  const relationPaths = parseResolveRelations(requestQuery);
  if (relationPaths.length === 0) {
    return null;
  }

  const relationMap = buildRelationMap(responseData.rels);
  const missingUuids = (responseData.rel_uuids ?? []).filter((uuid) => !relationMap.has(uuid));
  if (missingUuids.length === 0) {
    return { relationPaths, relationMap, links: [] };
  }

  const fetched = await fetchStoriesByUuids({
    client,
    uuids: missingUuids,
    baseQuery: requestQuery,
    throttleManager,
    signal,
  });
  for (const relationStory of fetched.stories) {
    relationMap.set(relationStory.uuid, relationStory);
  }

  return { relationPaths, relationMap, links: fetched.links };
};

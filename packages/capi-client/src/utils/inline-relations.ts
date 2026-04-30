import type { Client } from "../generated/shared/client";
import type { StoryCapi } from "../generated/stories";
import type { StoryWithInlinedRelations } from "../resources/stories";
import { fetchMissingRelations } from "./fetch-rel-uuids";
import type { ThrottleManager } from "./rate-limit";

type RelationPath = `${string}.${string}`;

interface ComponentNode {
  _uid: string;
  component: string;
  [key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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

const inlineStoryContentInternal = <TStory extends StoryCapi | StoryWithInlinedRelations>(
  story: TStory,
  relationPaths: ReadonlySet<RelationPath>,
  relationMap: ReadonlyMap<string, TStory>,
  resolved: Map<string, TStory>,
): TStory => {
  const existingStory = resolved.get(story.uuid);
  if (existingStory) {
    return existingStory;
  }

  const clonedStory = structuredClone(story);
  resolved.set(story.uuid, clonedStory);
  // resolveNode returns `unknown` to handle arbitrary JSON trees; shape is preserved at runtime.
  clonedStory.content = resolveNode(
    clonedStory.content,
    relationMap,
    relationPaths,
    resolved,
  ) as StoryCapi["content"];
  return clonedStory;
};

function resolveNode<TStory extends StoryCapi | StoryWithInlinedRelations>(
  value: unknown,
  relationMap: ReadonlyMap<string, TStory>,
  relationPaths: ReadonlySet<RelationPath>,
  resolved: Map<string, TStory>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveNode(item, relationMap, relationPaths, resolved));
  }

  if (!isRecord(value)) {
    return value;
  }

  if (isComponentNode(value)) {
    for (const [fieldName, fieldValue] of Object.entries(value)) {
      if (fieldName === "component" || fieldName === "_uid") {
        continue;
      }

      const relationPath: RelationPath = `${value.component}.${fieldName}`;
      value[fieldName] = relationPaths.has(relationPath)
        ? resolveFieldValue(fieldValue, relationMap, relationPaths, resolved)
        : resolveNode(fieldValue, relationMap, relationPaths, resolved);
    }

    return value;
  }

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    value[fieldName] = resolveNode(fieldValue, relationMap, relationPaths, resolved);
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

export const buildRelationMap = (rels: Array<StoryCapi> | undefined): Map<string, StoryCapi> => {
  const relationMap = new Map<string, StoryCapi>();

  for (const story of rels ?? []) {
    relationMap.set(story.uuid, story);
  }

  return relationMap;
};

function resolveFieldValue<TStory extends StoryCapi | StoryWithInlinedRelations>(
  value: unknown,
  relationMap: ReadonlyMap<string, TStory>,
  relationPaths: ReadonlySet<RelationPath>,
  resolved: Map<string, TStory>,
): unknown {
  if (typeof value === "string") {
    const relatedStory = relationMap.get(value);
    if (!relatedStory) {
      return value;
    }

    return inlineStoryContentInternal(relatedStory, relationPaths, relationMap, resolved);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveFieldValue(item, relationMap, relationPaths, resolved));
  }

  return resolveNode(value, relationMap, relationPaths, resolved);
}

export const inlineStoryContent = <TStory extends StoryCapi | StoryWithInlinedRelations>(
  story: TStory,
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
): TStory => {
  const normalizedPaths = new Set(relationPaths);
  const resolved = new Map<string, TStory>();
  return inlineStoryContentInternal(story, normalizedPaths, relationMap, resolved);
};

export const inlineStoriesContent = <TStory extends StoryCapi | StoryWithInlinedRelations>(
  stories: Array<TStory>,
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
): Array<TStory> => {
  const normalizedPaths = new Set(relationPaths);
  const resolved = new Map<string, TStory>();
  return stories.map((story) =>
    inlineStoryContentInternal(story, normalizedPaths, relationMap, resolved),
  );
};

interface ResolveRelationMapOptions {
  client: Client;
  throttleManager: ThrottleManager;
}

export interface ResolvedRelations {
  relationPaths: RelationPath[];
  relationMap: Map<string, StoryCapi>;
}

/**
 * Parses relation paths from the request query, builds a relation map from the
 * response's `rels`, and fetches any additional relations referenced by `rel_uuids`.
 *
 * Returns `null` when there is nothing to inline (no `resolve_relations` in the query).
 */
export const resolveRelationMap = async (
  responseData: { rels?: StoryCapi[]; rel_uuids?: string[] },
  requestQuery: Record<string, unknown>,
  { client, throttleManager }: ResolveRelationMapOptions,
): Promise<ResolvedRelations | null> => {
  const relationPaths = parseResolveRelations(requestQuery);
  if (relationPaths.length === 0) {
    return null;
  }

  const relationMap = buildRelationMap(responseData.rels);
  if (responseData.rel_uuids?.length) {
    const missingUuids = responseData.rel_uuids.filter((uuid) => !relationMap.has(uuid));
    if (missingUuids.length > 0) {
      const fetchedRelations = await fetchMissingRelations({
        client,
        uuids: missingUuids,
        baseQuery: requestQuery,
        throttleManager,
      });
      for (const relationStory of fetchedRelations) {
        relationMap.set(relationStory.uuid, relationStory);
      }
    }
  }

  return { relationPaths, relationMap };
};

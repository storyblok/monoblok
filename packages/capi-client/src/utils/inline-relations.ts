import type { Client } from "../generated/capi/client";
import type { Story } from "../generated/types/story";
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

export interface InlineRelationsOptions {
  /**
   * Whether a relation back to a story that is still being inlined resolves to that
   * story, making the result circular. Otherwise it stays a UUID.
   * @default true
   */
  circularReferences?: boolean;
  /** Called for each relation that makes the result circular. */
  onCircularReference?: () => void;
}

interface InlineContext<TStory> {
  relationPaths: ReadonlySet<RelationPath>;
  relationMap: ReadonlyMap<string, TStory>;
  resolved: Map<string, TStory>;
  storiesInProgress: Set<string>;
  circularReferences: boolean;
  onCircularReference?: () => void;
}

const createInlineContext = <TStory>(
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
  { circularReferences = true, onCircularReference }: InlineRelationsOptions,
): InlineContext<TStory> => ({
  relationPaths: new Set(relationPaths),
  relationMap,
  resolved: new Map(),
  storiesInProgress: new Set(),
  circularReferences,
  onCircularReference,
});

const inlineStoryContentInternal = <TStory extends Story | StoryWithInlinedRelations>(
  story: TStory,
  context: InlineContext<TStory>,
): TStory => {
  const existingStory = context.resolved.get(story.uuid);
  if (existingStory) {
    return existingStory;
  }

  const clonedStory = structuredClone(story);
  context.resolved.set(story.uuid, clonedStory);
  context.storiesInProgress.add(story.uuid);
  // resolveNode returns `unknown` to handle arbitrary JSON trees; shape is preserved at runtime.
  clonedStory.content = resolveNode(clonedStory.content, context) as Story["content"];
  context.storiesInProgress.delete(story.uuid);
  return clonedStory;
};

function resolveNode<TStory extends Story | StoryWithInlinedRelations>(
  value: unknown,
  context: InlineContext<TStory>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveNode(item, context));
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
        ? resolveFieldValue(fieldValue, context)
        : resolveNode(fieldValue, context);
    }

    return value;
  }

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    value[fieldName] = resolveNode(fieldValue, context);
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
  context: InlineContext<TStory>,
): unknown {
  if (typeof value === "string") {
    const relatedStory = context.relationMap.get(value);
    if (!relatedStory) {
      return value;
    }

    if (context.storiesInProgress.has(value)) {
      if (!context.circularReferences) {
        return value;
      }
      context.onCircularReference?.();
    }

    return inlineStoryContentInternal(relatedStory, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveFieldValue(item, context));
  }

  return resolveNode(value, context);
}

export const inlineStoryContent = <TStory extends Story | StoryWithInlinedRelations>(
  story: TStory,
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
  options: InlineRelationsOptions = {},
): TStory =>
  inlineStoryContentInternal(story, createInlineContext(relationPaths, relationMap, options));

export const inlineStoriesContent = <TStory extends Story | StoryWithInlinedRelations>(
  stories: Array<TStory>,
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
  options: InlineRelationsOptions = {},
): Array<TStory> => {
  const context = createInlineContext(relationPaths, relationMap, options);
  return stories.map((story) => inlineStoryContentInternal(story, context));
};

interface ResolveRelationMapOptions {
  client: Client;
  throttleManager: ThrottleManager;
}

export interface ResolvedRelations {
  relationPaths: RelationPath[];
  relationMap: Map<string, Story>;
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

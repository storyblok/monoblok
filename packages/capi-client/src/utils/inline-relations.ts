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
 * Levels of related stories below a requested story that `circularRelations: false`
 * inlines, matching `storyblok-js-client`: relations of the deepest level stay UUIDs.
 */
const MAX_ACYCLIC_RELATION_DEPTH = 2;

export interface InlineRelationsOptions {
  /** The client's `circularRelations` option; `undefined` is the deprecated default. */
  circularRelations: boolean | undefined;
}

interface InlineContext<TStory> {
  relationPaths: ReadonlySet<RelationPath>;
  relationMap: ReadonlyMap<string, TStory>;
  allowCircular: boolean;
  /** One copy per UUID when circular references are allowed, else one per level and UUID. */
  copies: Map<string, TStory>;
  /** Copies whose content is still being inlined; reaching one again closes a cycle. */
  copiesInProgress: Set<string>;
  isCircular: boolean;
}

let hasWarnedAboutCircularDefault = false;

const warnAboutCircularDefault = () => {
  if (hasWarnedAboutCircularDefault) {
    return;
  }
  hasWarnedAboutCircularDefault = true;
  console.warn(
    "[storyblok/api-client] Inlined relations produced a circular result, so `JSON.stringify` throws on it. " +
      "In 1.0, the `circularRelations` client option is removed and relations always behave like " +
      "`circularRelations: false`: inlined two levels deep and never circular. " +
      "Set `circularRelations: false` to switch now, or `true` to keep circular results until 1.0. " +
      "Setting either value silences this warning.",
  );
};

const createInlineContext = <TStory>(
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
  { circularRelations }: InlineRelationsOptions,
): InlineContext<TStory> => ({
  relationPaths: new Set(relationPaths),
  relationMap,
  allowCircular: circularRelations !== false,
  copies: new Map(),
  copiesInProgress: new Set(),
  isCircular: false,
});

const reportCircularDefault = (
  context: InlineContext<unknown>,
  { circularRelations }: InlineRelationsOptions,
) => {
  if (context.isCircular && circularRelations === undefined) {
    warnAboutCircularDefault();
  }
};

const inlineStory = <TStory extends Story | StoryWithInlinedRelations>(
  story: TStory,
  depth: number,
  context: InlineContext<TStory>,
): TStory => {
  const copyKey = context.allowCircular ? story.uuid : `${depth}:${story.uuid}`;
  const existingCopy = context.copies.get(copyKey);
  if (existingCopy) {
    if (context.copiesInProgress.has(copyKey)) {
      context.isCircular = true;
    }
    return existingCopy;
  }

  const clonedStory = structuredClone(story);
  context.copies.set(copyKey, clonedStory);
  if (!context.allowCircular && depth >= MAX_ACYCLIC_RELATION_DEPTH) {
    return clonedStory;
  }

  context.copiesInProgress.add(copyKey);
  // resolveNode returns `unknown` to handle arbitrary JSON trees; shape is preserved at runtime.
  clonedStory.content = resolveNode(clonedStory.content, depth, context) as Story["content"];
  context.copiesInProgress.delete(copyKey);
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

export const inlineStoryContent = <TStory extends Story | StoryWithInlinedRelations>(
  story: TStory,
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
  options: InlineRelationsOptions,
): TStory => {
  const context = createInlineContext(relationPaths, relationMap, options);
  const inlinedStory = inlineStory(story, 0, context);
  reportCircularDefault(context, options);
  return inlinedStory;
};

export const inlineStoriesContent = <TStory extends Story | StoryWithInlinedRelations>(
  stories: Array<TStory>,
  relationPaths: RelationPath[],
  relationMap: ReadonlyMap<string, TStory>,
  options: InlineRelationsOptions,
): Array<TStory> => {
  const context = createInlineContext(relationPaths, relationMap, options);
  const inlinedStories = stories.map((story) => inlineStory(story, 0, context));
  reportCircularDefault(context, options);
  return inlinedStories;
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

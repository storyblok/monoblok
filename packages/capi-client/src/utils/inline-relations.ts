import type { StoryCapi } from '../generated/stories';

type RelationPath = `${string}.${string}`;

interface ComponentNode {
  _uid: string;
  component: string;
  [key: string]: unknown;
}

const isComponentNode = (value: unknown): value is ComponentNode => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const node = value as Partial<ComponentNode>;
  return typeof node.component === 'string' && typeof node._uid === 'string';
};

const inlineStoryContentInternal = (
  story: StoryCapi,
  relationPaths: ReadonlySet<RelationPath>,
  relationMap: ReadonlyMap<string, StoryCapi>,
  resolved: Map<string, StoryCapi>,
): StoryCapi => {
  const existingStory = resolved.get(story.uuid);
  if (existingStory) {
    return existingStory;
  }

  const clonedStory = structuredClone(story);
  resolved.set(story.uuid, clonedStory);
  clonedStory.content = resolveNode(clonedStory.content, relationMap, relationPaths, resolved) as StoryCapi['content'];
  return clonedStory;
};

function resolveNode(
  value: unknown,
  relationMap: ReadonlyMap<string, StoryCapi>,
  relationPaths: ReadonlySet<RelationPath>,
  resolved: Map<string, StoryCapi>,
): unknown {
  if (Array.isArray(value)) {
    return value.map(item => resolveNode(item, relationMap, relationPaths, resolved));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result = value as Record<string, unknown>;

  if (isComponentNode(result)) {
    for (const [fieldName, fieldValue] of Object.entries(result)) {
      if (fieldName === 'component' || fieldName === '_uid') {
        continue;
      }

      const relationPath = `${result.component}.${fieldName}` as RelationPath;
      result[fieldName] = relationPaths.has(relationPath)
        ? resolveFieldValue(fieldValue, relationMap, relationPaths, resolved)
        : resolveNode(fieldValue, relationMap, relationPaths, resolved);
    }

    return result;
  }

  for (const [fieldName, fieldValue] of Object.entries(result)) {
    result[fieldName] = resolveNode(fieldValue, relationMap, relationPaths, resolved);
  }

  return result;
}

export const parseResolveRelations = (query: Record<string, unknown>): string[] => {
  if (typeof query.resolve_relations !== 'string') {
    return [];
  }

  return query.resolve_relations
    .split(',')
    .map(path => path.trim())
    .filter((path): path is string => {
      const [component = '', field = '', ...rest] = path.split('.');
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

export function resolveFieldValue(
  value: unknown,
  relationMap: ReadonlyMap<string, StoryCapi>,
  relationPaths: ReadonlySet<RelationPath>,
  resolved: Map<string, StoryCapi>,
): unknown {
  if (typeof value === 'string') {
    const relatedStory = relationMap.get(value);
    if (!relatedStory) {
      return value;
    }

    return inlineStoryContentInternal(relatedStory, relationPaths, relationMap, resolved);
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveFieldValue(item, relationMap, relationPaths, resolved));
  }

  return resolveNode(value, relationMap, relationPaths, resolved);
}

export const inlineStoryContent = (
  story: StoryCapi,
  relationPaths: string[],
  relationMap: ReadonlyMap<string, StoryCapi>,
): StoryCapi => {
  const normalizedPaths = new Set(relationPaths as RelationPath[]);
  const resolved = new Map<string, StoryCapi>();
  return inlineStoryContentInternal(story, normalizedPaths, relationMap, resolved);
};

export const inlineStoriesContent = (
  stories: Array<StoryCapi>,
  relationPaths: string[],
  relationMap: ReadonlyMap<string, StoryCapi>,
): Array<StoryCapi> => {
  const normalizedPaths = new Set(relationPaths as RelationPath[]);
  const resolved = new Map<string, StoryCapi>();
  return stories.map(story => inlineStoryContentInternal(story, normalizedPaths, relationMap, resolved));
};

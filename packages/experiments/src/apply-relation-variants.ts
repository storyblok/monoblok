import type { ResolvedRelations } from "./resolve-relations";

/** A variant story as the stories API returns it, for example from `by_uuids`. */
export interface VariantStory {
  uuid: string;
  content: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function replaceContent(
  node: unknown,
  contentByUuid: ReadonlyMap<string, unknown>,
  visited: Set<object>,
): void {
  if (!isRecord(node) || visited.has(node)) {
    return;
  }
  visited.add(node);

  if (typeof node.uuid === "string" && "content" in node && contentByUuid.has(node.uuid)) {
    node.content = structuredClone(contentByUuid.get(node.uuid));
    return;
  }
  for (const child of Object.values(node)) {
    replaceContent(child, contentByUuid, visited);
  }
}

/**
 * Returns a copy of `value` in which every story that `resolution` maps to a
 * variant carries the variant story's `content`. The story keeps its own id,
 * uuid, and slug, as with the `resolve_experiment_variants` parameter.
 *
 * `value` can be any shape holding stories: a response's `rels`, a whole
 * response, or a story whose relations were inlined with `inlineRelations`.
 * It is never mutated, since it may be a cached response shared with other
 * visitors. A story whose variant is missing from `variantStories`, such as an
 * unpublished variant fetched with a public token, keeps its original content.
 */
export function applyRelationVariants<T>(
  value: T,
  variantStories: readonly VariantStory[],
  resolution: Pick<ResolvedRelations, "variants">,
): T {
  const variantContent = new Map(variantStories.map((story) => [story.uuid, story.content]));
  const contentByUuid = new Map<string, unknown>();
  for (const [originalUuid, variantUuid] of resolution.variants) {
    if (variantContent.has(variantUuid)) {
      contentByUuid.set(originalUuid, variantContent.get(variantUuid));
    }
  }
  if (contentByUuid.size === 0) {
    return value;
  }

  const copy = structuredClone(value);
  replaceContent(copy, contentByUuid, new Set());
  return copy;
}

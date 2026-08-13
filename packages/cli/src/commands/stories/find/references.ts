import type { Component } from "../../../types";
import type { Story } from "../constants";
import { baseFieldName, isStoryRelationField } from "../content-fields";

export type RefType = "multilink" | "richtext" | "relation";
export type IssueType = "broken" | "unpublished" | "stale_url";

export interface RefEntry {
  targetUuid: string;
  refType: RefType;
  fieldPath: string;
  cachedUrl?: string;
}

export interface RefIssue {
  type: IssueType;
  ref_type: RefType;
  target_uuid: string;
  cached_url?: string;
  actual_url?: string;
  field_path: string;
}

export interface TargetMeta {
  full_slug: string;
  /** `null` when the API did not report a publish state (unknown, not "unpublished"). */
  is_published: boolean | null;
  is_folder?: boolean;
}

/** Projects a story into the metadata a reference check needs about its target. */
export function toTargetMeta(story: Story): TargetMeta {
  return {
    full_slug: story.full_slug ?? "",
    is_published: story.published ?? null,
    is_folder: story.is_folder ?? false,
  };
}

export type RelationFieldMap = Map<string, Set<string>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildRelationFieldMap(components: Component[]): RelationFieldMap {
  const map: RelationFieldMap = new Map();
  for (const component of components) {
    const relationFields = new Set<string>();
    for (const [fieldName, field] of Object.entries(component.schema ?? {})) {
      if (isStoryRelationField(field)) {
        relationFields.add(fieldName);
      }
    }
    if (relationFields.size > 0) {
      map.set(component.name, relationFields);
    }
  }
  return map;
}

export function extractReferences(story: Story, relationFieldMap: RelationFieldMap): RefEntry[] {
  const refs: RefEntry[] = [];
  if (story.content && typeof story.content === "object") {
    walkNode(story.content, "content", undefined, relationFieldMap, refs);
  }
  return refs;
}

function walkNode(
  node: unknown,
  path: string,
  componentName: string | undefined,
  relationFieldMap: RelationFieldMap,
  refs: RefEntry[],
): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      walkNode(node[i], `${path}[${i}]`, componentName, relationFieldMap, refs);
    }
    return;
  }

  if (node === null || typeof node !== "object") {
    return;
  }

  const obj = node as Record<string, unknown>;

  // Multilink field: { fieldtype: "multilink", linktype: "story", id: "<uuid>" }
  if (
    obj.fieldtype === "multilink" &&
    obj.linktype === "story" &&
    typeof obj.id === "string" &&
    UUID_RE.test(obj.id)
  ) {
    refs.push({
      targetUuid: obj.id,
      refType: "multilink",
      fieldPath: path,
      cachedUrl: typeof obj.cached_url === "string" ? obj.cached_url : undefined,
    });
    return;
  }

  // Richtext link mark: { type: "link", attrs: { linktype: "story", uuid: "<uuid>" } }
  if (obj.type === "link" && obj.attrs && typeof obj.attrs === "object") {
    const attrs = obj.attrs as Record<string, unknown>;
    if (attrs.linktype === "story" && typeof attrs.uuid === "string" && UUID_RE.test(attrs.uuid)) {
      refs.push({
        targetUuid: attrs.uuid,
        refType: "richtext",
        fieldPath: path,
        cachedUrl: typeof attrs.href === "string" ? attrs.href : undefined,
      });
      return;
    }
  }

  // Track current component name for relation field lookup
  const currentComponent = typeof obj.component === "string" ? obj.component : componentName;

  // Relation fields (schema-aware). Iterate the node's own keys rather than the
  // schema's field names so a field-level translation (`link__i18n__de`) is
  // matched by its base name instead of being skipped.
  if (currentComponent) {
    const relationFields = relationFieldMap.get(currentComponent);
    if (relationFields) {
      for (const [key, value] of Object.entries(obj)) {
        if (!relationFields.has(baseFieldName(key))) {
          continue;
        }
        if (typeof value === "string" && UUID_RE.test(value)) {
          refs.push({
            targetUuid: value,
            refType: "relation",
            fieldPath: `${path}.${key}`,
          });
        } else if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] === "string" && UUID_RE.test(value[i])) {
              refs.push({
                targetUuid: value[i],
                refType: "relation",
                fieldPath: `${path}.${key}[${i}]`,
              });
            }
          }
        }
      }
    }
  }

  // Recurse into object values
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_uid") {
      continue;
    }
    if (typeof value === "object" && value !== null) {
      walkNode(value, `${path}.${key}`, currentComponent, relationFieldMap, refs);
    }
  }
}

const normalizePath = (url: string): string => url.replace(/^\/+/, "").replace(/\/+$/, "");

export function detectIssues(refs: RefEntry[], targetMap: Map<string, TargetMeta>): RefIssue[] {
  const issues: RefIssue[] = [];
  for (const ref of refs) {
    const target = targetMap.get(ref.targetUuid);
    if (!target) {
      issues.push({
        type: "broken",
        ref_type: ref.refType,
        target_uuid: ref.targetUuid,
        cached_url: ref.cachedUrl,
        field_path: ref.fieldPath,
      });
      continue;
    }
    // Only an explicit `false` counts: a folder is not a publishable entity, and
    // `null` means the API never told us — reporting either would be a false positive.
    if (target.is_published === false && !target.is_folder) {
      issues.push({
        type: "unpublished",
        ref_type: ref.refType,
        target_uuid: ref.targetUuid,
        cached_url: ref.cachedUrl,
        actual_url: target.full_slug,
        field_path: ref.fieldPath,
      });
      continue;
    }
    if (
      ref.cachedUrl !== undefined &&
      normalizePath(ref.cachedUrl) !== normalizePath(target.full_slug)
    ) {
      issues.push({
        type: "stale_url",
        ref_type: ref.refType,
        target_uuid: ref.targetUuid,
        cached_url: ref.cachedUrl,
        actual_url: target.full_slug,
        field_path: ref.fieldPath,
      });
    }
  }
  return issues;
}

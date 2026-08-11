import type { Component } from '../../../types';
import type { Story } from '../constants';

export type RefType = 'multilink' | 'richtext' | 'relation';
export type IssueType = 'broken' | 'unpublished' | 'stale_url';

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
  is_published: boolean | null;
}

export type RelationFieldMap = Map<string, Set<string>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildRelationFieldMap(components: Component[]): RelationFieldMap {
  const map: RelationFieldMap = new Map();
  for (const component of components) {
    const relationFields = new Set<string>();
    for (const [fieldName, field] of Object.entries(component.schema ?? {})) {
      if (
        (field.type === 'option' || field.type === 'options')
        && typeof field.source === 'string'
        && field.source === 'internal_stories'
      ) {
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
  if (story.content && typeof story.content === 'object') {
    walkNode(story.content, 'content', undefined, relationFieldMap, refs);
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

  if (node === null || typeof node !== 'object') {
    return;
  }

  const obj = node as Record<string, unknown>;

  // Multilink field: { fieldtype: "multilink", linktype: "story", id: "<uuid>" }
  if (obj.fieldtype === 'multilink' && obj.linktype === 'story' && typeof obj.id === 'string' && UUID_RE.test(obj.id)) {
    refs.push({
      targetUuid: obj.id,
      refType: 'multilink',
      fieldPath: path,
      cachedUrl: typeof obj.cached_url === 'string' ? obj.cached_url : undefined,
    });
    return;
  }

  // Richtext link mark: { type: "link", attrs: { linktype: "story", uuid: "<uuid>" } }
  if (obj.type === 'link' && obj.attrs && typeof obj.attrs === 'object') {
    const attrs = obj.attrs as Record<string, unknown>;
    if (attrs.linktype === 'story' && typeof attrs.uuid === 'string' && UUID_RE.test(attrs.uuid)) {
      refs.push({
        targetUuid: attrs.uuid,
        refType: 'richtext',
        fieldPath: path,
        cachedUrl: typeof attrs.href === 'string' ? attrs.href : undefined,
      });
      return;
    }
  }

  // Track current component name for relation field lookup
  const currentComponent = typeof obj.component === 'string' ? obj.component : componentName;

  // Relation fields (schema-aware)
  if (currentComponent) {
    const relationFields = relationFieldMap.get(currentComponent);
    if (relationFields) {
      for (const fieldName of relationFields) {
        if (fieldName in obj) {
          const value = obj[fieldName];
          if (typeof value === 'string' && UUID_RE.test(value)) {
            refs.push({ targetUuid: value, refType: 'relation', fieldPath: `${path}.${fieldName}` });
          }
          else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              if (typeof value[i] === 'string' && UUID_RE.test(value[i])) {
                refs.push({ targetUuid: value[i], refType: 'relation', fieldPath: `${path}.${fieldName}[${i}]` });
              }
            }
          }
        }
      }
    }
  }

  // Recurse into object values
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_uid') {
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      walkNode(value, `${path}.${key}`, currentComponent, relationFieldMap, refs);
    }
  }
}

const normalizePath = (url: string): string => url.replace(/^\/+/, '').replace(/\/+$/, '');

export function detectIssues(refs: RefEntry[], targetMap: Map<string, TargetMeta>): RefIssue[] {
  const issues: RefIssue[] = [];
  for (const ref of refs) {
    const target = targetMap.get(ref.targetUuid);
    if (!target) {
      issues.push({
        type: 'broken',
        ref_type: ref.refType,
        target_uuid: ref.targetUuid,
        cached_url: ref.cachedUrl,
        field_path: ref.fieldPath,
      });
      continue;
    }
    if (!target.is_published) {
      issues.push({
        type: 'unpublished',
        ref_type: ref.refType,
        target_uuid: ref.targetUuid,
        cached_url: ref.cachedUrl,
        actual_url: target.full_slug,
        field_path: ref.fieldPath,
      });
      continue;
    }
    if (ref.cachedUrl !== undefined && normalizePath(ref.cachedUrl) !== normalizePath(target.full_slug)) {
      issues.push({
        type: 'stale_url',
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

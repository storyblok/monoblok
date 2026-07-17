import type { ValidationIssue } from './adapter';
import type { ValidationGroup } from './types';

/**
 * Turns an `entity` identifier into a display header:
 * `block:hero` → `hero (block)`, `datasource:colors` → `colors (datasource)`,
 * and a bare `schema` stays `schema`.
 */
export function entityToHeader(entity: string): string {
  const separator = entity.indexOf(':');
  if (separator === -1) {
    return entity;
  }
  const type = entity.slice(0, separator);
  const name = entity.slice(separator + 1);
  return `${name} (${type})`;
}

/** Groups issues by their `entity`, preserving first-seen order. */
export function groupIssuesByEntity(issues: readonly ValidationIssue[]): ValidationGroup[] {
  const byEntity = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const existing = byEntity.get(issue.entity);
    if (existing) {
      existing.push(issue);
    }
    else {
      byEntity.set(issue.entity, [issue]);
    }
  }
  return [...byEntity].map(([entity, entityIssues]) => ({
    header: entityToHeader(entity),
    issues: entityIssues,
  }));
}

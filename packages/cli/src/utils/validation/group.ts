import type { ValidationIssue } from './adapter';
import type { ValidationGroup, ValidationGroupRef } from './types';

/**
 * Turns an `entity` identifier into a display header:
 * `block:hero` → `hero (block)`, `datasource:colors` → `colors (datasource)`,
 * and a bare `schema` stays `schema`.
 *
 * An entity with an empty name (`block:`) would render as a blank heading, so it
 * falls back to `<unnamed block>`. `validateSchema` attributes nameless entities
 * to `schema` instead, so this only guards against a hand-built or future issue
 * source.
 */
export function entityToHeader(entity: string): string {
  const separator = entity.indexOf(':');
  if (separator === -1) {
    return entity;
  }
  const type = entity.slice(0, separator);
  const name = entity.slice(separator + 1);
  if (name === '') {
    return `<unnamed ${type}>`;
  }
  return `${name} (${type})`;
}

/**
 * Turns an `entity` identifier into the machine-readable {@link
 * ValidationGroupRef} that travels next to the rendered header. An entity the
 * validators do not attribute to a block or datasource (`schema`, or anything
 * added later) reports as `kind: 'schema'` rather than guessing a type.
 */
export function entityToRef(entity: string): ValidationGroupRef {
  const separator = entity.indexOf(':');
  const type = separator === -1 ? entity : entity.slice(0, separator);
  const name = separator === -1 ? undefined : entity.slice(separator + 1);
  if (type === 'block' || type === 'datasource') {
    return { kind: type, ...(name ? { name } : {}) };
  }
  return { kind: 'schema' };
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
    ref: entityToRef(entity),
    issues: entityIssues,
  }));
}

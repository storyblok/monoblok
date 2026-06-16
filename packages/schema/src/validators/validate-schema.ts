import type { SchemaLike } from './shapes';
import type { ValidationIssue, ValidationResult } from './types';
import { toValues } from './shapes';

/**
 * Validates a schema definition without throwing. Checks structural identity
 * (duplicate block names, field names, and datasource slugs) and cross-references
 * (every `allow` entry resolves to a defined block; every field `datasource`
 * resolves to a defined datasource).
 *
 * @example
 * const result = validateSchema({ blocks: { hero }, datasources: { colors } });
 * if (!result.ok) console.error(result.issues);
 */
export function validateSchema(schema: SchemaLike): ValidationResult {
  const issues: ValidationIssue[] = [];
  const blocks = toValues(schema.blocks);
  const datasources = toValues(schema.datasources);

  const datasourceSlugs = new Set<string>();
  for (const datasource of datasources) {
    const slug = datasource?.slug;
    if (typeof slug !== 'string') {
      continue;
    }
    if (datasourceSlugs.has(slug)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_datasource_slug',
        path: ['datasources', slug],
        entity: `datasource:${slug}`,
        message: `Duplicate datasource slug "${slug}".`,
      });
    }
    datasourceSlugs.add(slug);
  }

  const blockNames = new Set<string>();
  for (const block of blocks) {
    const name = block?.name;
    if (typeof name !== 'string') {
      continue;
    }
    if (blockNames.has(name)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_block_name',
        path: ['blocks', name],
        entity: `block:${name}`,
        message: `Duplicate block name "${name}".`,
      });
    }
    blockNames.add(name);
  }

  // Field-level checks run after the name/slug sets are fully populated so that
  // forward and circular references (resolved by name) validate correctly.
  for (const block of blocks) {
    const blockName = typeof block?.name === 'string' ? block.name : '';
    const fieldNames = new Set<string>();
    for (const field of block?.fields ?? []) {
      const fieldName = field?.name;
      if (typeof fieldName === 'string') {
        if (fieldNames.has(fieldName)) {
          issues.push({
            severity: 'error',
            code: 'duplicate_field_name',
            path: ['blocks', blockName, fieldName],
            entity: `block:${blockName}`,
            message: `Duplicate field name "${fieldName}" in block "${blockName}".`,
          });
        }
        fieldNames.add(fieldName);
      }

      for (const allowed of field?.allow ?? []) {
        if (typeof allowed === 'string' && !blockNames.has(allowed)) {
          issues.push({
            severity: 'error',
            code: 'unresolved_allow',
            path: ['blocks', blockName, fieldName ?? '', 'allow'],
            entity: `block:${blockName}`,
            message: `Field "${fieldName}" allows unknown block "${allowed}".`,
          });
        }
      }

      const datasource = field?.datasource;
      if (typeof datasource === 'string' && !datasourceSlugs.has(datasource)) {
        issues.push({
          severity: 'error',
          code: 'unresolved_datasource',
          path: ['blocks', blockName, fieldName ?? '', 'datasource'],
          entity: `block:${blockName}`,
          message: `Field "${fieldName}" references unknown datasource "${datasource}".`,
        });
      }
    }
  }

  return { ok: issues.every(issue => issue.severity !== 'error'), issues };
}

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { SchemaBlockLike, SchemaFieldLike, SchemaLike } from './shapes';
import type { ValidationIssue, ValidationResult } from './types';
import {
  zAssetFieldValue,
  zMultilinkFieldValue,
  zPluginFieldValue,
  zRichtextFieldValue,
  zTableFieldValue,
} from './internal-schemas';
import { isRecord, toValues } from './shapes';

/** Field-content keys that are not user-defined fields. */
const RESERVED_KEYS = new Set(['_uid', 'component', '_editable']);

/** Maps a Standard Schema validator to a {@link ValidationIssue} reporter at `path`. */
function checkValue(
  schema: StandardSchemaV1,
  value: unknown,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  const result = schema['~standard'].validate(value);
  // The Zod schemas are synchronous; a thenable result would indicate misuse.
  if (result instanceof Promise) {
    return;
  }
  if (result.issues) {
    for (const issue of result.issues) {
      const issuePath = (issue.path ?? []).map(segment =>
        (typeof segment === 'object' && segment !== null ? String(segment.key) : (segment as string | number)),
      );
      issues.push({
        severity: 'error',
        code: 'invalid_value',
        path: [...path, ...issuePath],
        entity,
        message: issue.message,
      });
    }
  }
}

function validateFieldValue(
  field: SchemaFieldLike,
  value: unknown,
  blocksByName: Map<string, SchemaBlockLike>,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  switch (field.type) {
    case 'asset':
      checkValue(zAssetFieldValue, value, path, entity, issues);
      break;
    case 'multiasset':
      if (!Array.isArray(value)) {
        pushTypeIssue(value, 'array', path, entity, issues);
        break;
      }
      value.forEach((item, index) => checkValue(zAssetFieldValue, item, [...path, index], entity, issues));
      break;
    case 'multilink':
      checkValue(zMultilinkFieldValue, value, path, entity, issues);
      break;
    case 'table':
      checkValue(zTableFieldValue, value, path, entity, issues);
      break;
    case 'richtext':
      checkValue(zRichtextFieldValue, value, path, entity, issues);
      validateRichtextBloks(value, blocksByName, path, issues);
      break;
    case 'custom':
      checkValue(zPluginFieldValue, value, path, entity, issues);
      break;
    case 'bloks':
      if (!Array.isArray(value)) {
        pushTypeIssue(value, 'array', path, entity, issues);
        break;
      }
      value.forEach((item, index) => validateBlokContent(item, blocksByName, [...path, index], issues));
      break;
    case 'text':
    case 'textarea':
    case 'markdown':
    case 'option':
    case 'datetime':
      if (typeof value !== 'string') {
        pushTypeIssue(value, 'string', path, entity, issues);
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        pushTypeIssue(value, 'number', path, entity, issues);
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        pushTypeIssue(value, 'boolean', path, entity, issues);
      }
      break;
    case 'options':
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        pushTypeIssue(value, 'string[]', path, entity, issues);
      }
      break;
    case 'section':
    case 'tab':
      // Layout-only field types carry no content value.
      break;
    default:
      // Exhaustiveness guard: when a new `FieldType` is added, this fails to
      // compile until the field type is handled (or explicitly skipped) above.
      field.type satisfies never;
      break;
  }
}

function pushTypeIssue(
  value: unknown,
  expected: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  issues.push({
    severity: 'error',
    code: 'invalid_value',
    path,
    entity,
    message: `Expected ${expected}, received ${value === null ? 'null' : typeof value}.`,
  });
}

/** Walks richtext `content` nodes and validates embedded bloks (`type: 'blok'`). */
function validateRichtextBloks(
  value: unknown,
  blocksByName: Map<string, SchemaBlockLike>,
  path: (string | number)[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return;
  }
  value.content.forEach((node, index) => {
    if (!isRecord(node)) {
      return;
    }
    if (node.type === 'blok' && isRecord(node.attrs) && Array.isArray(node.attrs.body)) {
      node.attrs.body.forEach((blok, blokIndex) =>
        validateBlokContent(blok, blocksByName, [...path, 'content', index, 'attrs', 'body', blokIndex], issues),
      );
    }
    else if (Array.isArray(node.content)) {
      // Recurse into nested marks/nodes that may themselves embed bloks.
      validateRichtextBloks(node, blocksByName, [...path, 'content', index], issues);
    }
  });
}

/** Validates a single blok content object against its component definition. */
function validateBlokContent(
  content: unknown,
  blocksByName: Map<string, SchemaBlockLike>,
  path: (string | number)[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(content)) {
    issues.push({
      severity: 'error',
      code: 'invalid_content',
      path,
      entity: 'story',
      message: 'Expected a block content object.',
    });
    return;
  }

  const component = content.component;
  const block = typeof component === 'string' ? blocksByName.get(component) : undefined;
  if (!block) {
    issues.push({
      severity: 'error',
      code: 'unknown_component',
      path: [...path, 'component'],
      entity: 'story',
      message: `Unknown component "${String(component)}".`,
    });
    return;
  }

  const entity = `block:${block.name}`;
  const fields = block.fields ?? [];
  const fieldsByName = new Map(fields.map(field => [field.name, field]));

  for (const key of Object.keys(content)) {
    if (!RESERVED_KEYS.has(key) && !fieldsByName.has(key)) {
      issues.push({
        severity: 'warning',
        code: 'unknown_field',
        path: [...path, key],
        entity,
        message: `Unknown field "${key}" on component "${block.name}".`,
      });
    }
  }

  for (const field of fields) {
    const value = content[field.name];
    if (value === undefined || value === null) {
      if (field.required) {
        issues.push({
          severity: 'error',
          code: 'missing_required_field',
          path: [...path, field.name],
          entity,
          message: `Missing required field "${field.name}" on component "${block.name}".`,
        });
      }
      continue;
    }
    validateFieldValue(field, value, blocksByName, [...path, field.name], entity, issues);
  }
}

/**
 * Validates a story's content against a schema without throwing. Reports unknown
 * components (error), unknown fields (warning), missing required fields (error),
 * and invalid field-value shapes (error), recursing into nested `bloks` and
 * richtext-embedded bloks.
 *
 * @example
 * const result = validateStory(story, { blocks: { page, hero } });
 */
export function validateStory(story: unknown, schema: SchemaLike): ValidationResult {
  const issues: ValidationIssue[] = [];
  const blocksByName = new Map(toValues(schema.blocks).map(block => [block.name, block]));
  const content = isRecord(story) ? story.content : undefined;
  validateBlokContent(content, blocksByName, ['content'], issues);
  return { ok: issues.every(issue => issue.severity !== 'error'), issues };
}

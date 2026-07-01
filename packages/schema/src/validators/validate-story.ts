import { z } from 'zod';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { SchemaBlockLike, SchemaFieldLike, SchemaLike } from './shapes';
import type { ValidationIssue, ValidationResult } from './types';
import {
  zAssetFieldValue,
  zMultilinkFieldValue,
  zRichtextFieldValue,
  zTableFieldValue,
} from './internal-schemas';
import { isRecord, toValues } from './shapes';

/** Field-content keys that are not user-defined fields. */
const RESERVED_KEYS = new Set(['_uid', 'component', '_editable']);

/**
 * Relaxed plugin envelope used by the `custom` case. Mirrors the generated
 * `zPluginFieldValue` but relaxes `_uid` from a UUID to a plain string, matching
 * the CMS, which persists arbitrary `_uid` strings. Kept local so a codegen
 * regenerate cannot revert it.
 */
const zPluginEnvelope = z.object({ plugin: z.string(), _uid: z.optional(z.string()) });

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
  fieldPluginsByType: Map<string, StandardSchemaV1>,
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
      checkCount(value.length, field.minimum_entries, field.maximum_entries, 'asset(s)', path, entity, issues);
      break;
    case 'multilink':
      checkValue(zMultilinkFieldValue, value, path, entity, issues);
      break;
    case 'table':
      checkValue(zTableFieldValue, value, path, entity, issues);
      break;
    case 'richtext':
      checkValue(zRichtextFieldValue, value, path, entity, issues);
      validateRichtextBloks(value, blocksByName, fieldPluginsByType, path, issues);
      break;
    case 'custom': {
      checkValue(zPluginEnvelope, value, path, entity, issues);
      const validator = field.field_type ? fieldPluginsByType.get(field.field_type) : undefined;
      if (validator && isRecord(value)) {
        // Envelope keys sit alongside the plugin's own keys; strip them so the
        // plugin validator sees only its value. Sibling keys keep issue paths
        // accurate (an issue at ['color'] maps to [...path, 'color']).
        const { plugin: _plugin, _uid, ...pluginValue } = value;
        checkValue(validator, pluginValue, path, entity, issues);
      }
      break;
    }
    case 'bloks':
      if (!Array.isArray(value)) {
        pushTypeIssue(value, 'array', path, entity, issues);
        break;
      }
      checkCount(value.length, field.minimum, field.maximum, 'block(s)', path, entity, issues);
      value.forEach((item, index) => {
        if (
          field.allow && field.allow.length > 0
          && isRecord(item) && typeof item.component === 'string'
          && !field.allow.includes(item.component)
        ) {
          issues.push({
            severity: 'error',
            code: 'disallowed_component',
            path: [...path, index, 'component'],
            entity,
            message: `Component "${item.component}" is not allowed in field "${field.name}"; allowed: ${field.allow.join(', ')}.`,
          });
        }
        validateBlokContent(item, blocksByName, fieldPluginsByType, [...path, index], issues);
      });
      break;
    case 'text':
    case 'textarea':
    case 'markdown':
      if (typeof value !== 'string') {
        pushTypeIssue(value, 'string', path, entity, issues);
        break;
      }
      checkStringLength(field, value, path, entity, issues);
      break;
    case 'option':
    case 'datetime':
      if (typeof value !== 'string') {
        pushTypeIssue(value, 'string', path, entity, issues);
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        pushTypeIssue(value, 'number', path, entity, issues);
        break;
      }
      if (field.min_value != null && value < field.min_value) {
        pushConstraint(`Value ${value} is below the minimum of ${field.min_value}.`, path, entity, issues);
      }
      if (field.max_value != null && value > field.max_value) {
        pushConstraint(`Value ${value} exceeds the maximum of ${field.max_value}.`, path, entity, issues);
      }
      if (field.decimals != null && decimalPlaces(value) > field.decimals) {
        pushConstraint(`Value ${value} has more than ${field.decimals} decimal place(s).`, path, entity, issues);
      }
      if (field.steps != null && field.steps > 0 && !isMultipleOf(value, field.steps, field.min_value ?? 0)) {
        const base = field.min_value ?? 0;
        pushConstraint(
          `Value ${value} is not a multiple of the step ${field.steps}${base ? ` (offset from ${base})` : ''}.`,
          path,
          entity,
          issues,
        );
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
        break;
      }
      checkCount(value.length, toCount(field.min_options), toCount(field.max_options), 'option(s)', path, entity, issues);
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

/** Reports a constraint (bound/length/count) violation as an error issue. */
function pushConstraint(
  message: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  issues.push({ severity: 'error', code: 'constraint_violation', path, entity, message });
}

/** Checks an array length against optional inclusive `min`/`max` bounds. */
function checkCount(
  length: number,
  min: number | undefined,
  max: number | undefined,
  noun: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  if (min != null && length < min) {
    pushConstraint(`Expected at least ${min} ${noun}, received ${length}.`, path, entity, issues);
  }
  if (max != null && length > max) {
    pushConstraint(`Expected at most ${max} ${noun}, received ${length}.`, path, entity, issues);
  }
}

/** Checks a string against optional `max_length`/`maxlength` and `minlength` bounds. */
function checkStringLength(
  field: SchemaFieldLike,
  value: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  const max = field.max_length ?? field.maxlength;
  if (max != null && value.length > max) {
    pushConstraint(`Text length ${value.length} exceeds the maximum of ${max}.`, path, entity, issues);
  }
  if (field.minlength != null && value.length < field.minlength) {
    pushConstraint(`Text length ${value.length} is below the minimum of ${field.minlength}.`, path, entity, issues);
  }
}

/** Counts a number's fractional digits, handling exponential notation (e.g. `1e-7` → 7). */
function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const text = String(value).toLowerCase();
  const [mantissa, exponent] = text.split('e');
  const fractionDigits = mantissa.includes('.') ? mantissa.split('.')[1].length : 0;
  // A negative exponent (e.g. `1e-7`) adds that many fractional digits.
  return exponent ? Math.max(0, fractionDigits - Number(exponent)) : fractionDigits;
}

/** Whether `value` lands on a `step` increment offset from `base`, with float tolerance. */
function isMultipleOf(value: number, step: number, base: number): boolean {
  const ratio = (value - base) / step;
  const tolerance = 1e-9 * Math.max(1, Math.abs(ratio));
  return Math.abs(ratio - Math.round(ratio)) <= tolerance;
}

/** Parses a numeric constraint stored as a string (e.g. `min_options`). Empty/non-numeric → undefined. */
function toCount(value: string | undefined): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  fieldPluginsByType: Map<string, StandardSchemaV1>,
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
        validateBlokContent(blok, blocksByName, fieldPluginsByType, [...path, 'content', index, 'attrs', 'body', blokIndex], issues),
      );
    }
    else if (Array.isArray(node.content)) {
      // Recurse into nested marks/nodes that may themselves embed bloks.
      validateRichtextBloks(node, blocksByName, fieldPluginsByType, [...path, 'content', index], issues);
    }
  });
}

/** Validates a single blok content object against its component definition. */
function validateBlokContent(
  content: unknown,
  blocksByName: Map<string, SchemaBlockLike>,
  fieldPluginsByType: Map<string, StandardSchemaV1>,
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
    validateFieldValue(field, value, blocksByName, fieldPluginsByType, [...path, field.name], entity, issues);
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
  const fieldPluginsByType = new Map(
    toValues(schema.fieldPlugins).map(plugin => [plugin.fieldType, plugin.value]),
  );
  const content = isRecord(story) ? story.content : undefined;
  validateBlokContent(content, blocksByName, fieldPluginsByType, ['content'], issues);
  return { ok: issues.every(issue => issue.severity !== 'error'), issues };
}

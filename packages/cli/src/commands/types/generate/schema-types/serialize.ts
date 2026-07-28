import type { Component } from '../../../../types';
import { toDslField } from '../../../schema/to-dsl-field';
import { INDENT, isRecord, quoteString, sortSchemaByPos } from '../../../schema/utils';

/** Resolution context shared by every block in one generation run. */
export interface SerializeContext {
  /** `component_group_uuid` → display-name path, e.g. `'My Layout/Heros'`. */
  displayPathByUuid: Map<string, string>;
}

/** One component serialized to the type-literal body of its definition type. */
export interface SerializedBlock {
  /** Technical component name, e.g. `'hero'`. */
  componentName: string;
  /** The emitted type literal, from `{` to `}`, without a trailing semicolon. */
  definitionBody: string;
  /** `field_type` values seen on `custom` fields, for unmapped-plugin warnings. */
  customFieldTypes: string[];
}

/**
 * Serializes one `allow` entry: a bare block name, or a folder reference. Any
 * other shape yields `undefined`, which drops the whole `allow` (no narrowing
 * is safer than wrong narrowing).
 */
function serializeAllowEntry(entry: unknown): string | undefined {
  if (typeof entry === 'string') { return quoteString(entry); }
  if (isRecord(entry) && typeof entry.folder === 'string') { return `{ folder: ${quoteString(entry.folder)} }`; }
  return undefined;
}

/**
 * Serializes one field to a type literal. Only the keys the type-level
 * machinery reads are emitted, `name`, `type`, `required` (when `true`),
 * `allow`, `field_type`. Everything else on the wire (`description`,
 * `translatable`, `default_value`, option lists, …) cannot affect the resulting
 * content type, so including it would be pure diff churn.
 */
function serializeField(
  fieldName: string,
  fieldData: Record<string, unknown>,
  context: SerializeContext,
): { code: string; customFieldType?: string } {
  const dsl = toDslField(fieldData, (uuid) => {
    const path = context.displayPathByUuid.get(uuid);
    return path === undefined ? undefined : { folder: path };
  });

  const members = [`name: ${quoteString(fieldName)}`];
  if (typeof dsl.type === 'string') { members.push(`type: ${quoteString(dsl.type)}`); }
  if (dsl.required === true) { members.push('required: true'); }

  if (Array.isArray(dsl.allow) && dsl.allow.length > 0) {
    const entries = dsl.allow.map(serializeAllowEntry);
    if (entries.every((entry): entry is string => entry !== undefined)) {
      members.push(`allow: [${entries.join(', ')}]`);
    }
  }

  const customFieldType = dsl.type === 'custom' && typeof dsl.field_type === 'string'
    ? dsl.field_type
    : undefined;
  if (customFieldType !== undefined) { members.push(`field_type: ${quoteString(customFieldType)}`); }

  return {
    code: `{ ${members.join('; ')} }`,
    ...(customFieldType === undefined ? {} : { customFieldType }),
  };
}

/**
 * Serializes a component to its block definition type literal.
 *
 * `id`, `created_at`, and `updated_at` are required by the MAPI `Component`
 * that `Block` extends, but nothing at the type level reads their values, so
 * they are emitted widened (`id: number`) rather than as the fetched
 * literals, which would churn the diff on every regeneration. `name`,
 * `is_root`, `is_nestable`, `folder`, and `fields` are read by
 * `BlockContent`/`ApplyAllow`/`RootBlock`, so those stay literal.
 */
export function serializeBlockDefinition(component: Component, context: SerializeContext): SerializedBlock {
  const lines = ['{'];
  lines.push(`${INDENT}readonly id: number;`);
  lines.push(`${INDENT}created_at: string;`);
  lines.push(`${INDENT}updated_at: string;`);
  lines.push(`${INDENT}name: ${quoteString(component.name)};`);
  lines.push(`${INDENT}is_root: ${component.is_root === true ? 'true' : 'false'};`);
  lines.push(`${INDENT}is_nestable: ${component.is_nestable === false ? 'false' : 'true'};`);

  const groupUuid = component.component_group_uuid;
  const folderPath = typeof groupUuid === 'string' ? context.displayPathByUuid.get(groupUuid) : undefined;
  if (folderPath !== undefined) { lines.push(`${INDENT}folder: ${quoteString(folderPath)};`); }

  const schema = isRecord(component.schema) ? component.schema as Record<string, Record<string, unknown>> : {};
  const fields = sortSchemaByPos(schema).filter(([, data]) => isRecord(data));

  const customFieldTypes: string[] = [];
  if (fields.length === 0) {
    lines.push(`${INDENT}fields: [];`);
  }
  else {
    lines.push(`${INDENT}fields: [`);
    for (const [fieldName, fieldData] of fields) {
      const { code, customFieldType } = serializeField(fieldName, fieldData, context);
      if (customFieldType !== undefined && !customFieldTypes.includes(customFieldType)) {
        customFieldTypes.push(customFieldType);
      }
      lines.push(`${INDENT}${INDENT}${code},`);
    }
    lines.push(`${INDENT}];`);
  }

  lines.push('}');

  return { componentName: component.name, definitionBody: lines.join('\n'), customFieldTypes };
}

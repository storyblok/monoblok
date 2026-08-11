import type { Component } from "../../../../types";
import { toDslField } from "../../../schema/to-dsl-field";
import { INDENT, isRecord, quoteString, sortSchemaByPos } from "../../../schema/utils";

/** Resolution context shared by every block in one generation run. */
export interface SerializeContext {
  /** `component_group_uuid` → display-name path, e.g. `'My Layout/Heros'`. */
  displayPathByUuid: Map<string, string>;
  /**
   * Every component name the space returned. Used to drop `allow` entries that
   * name a block which no longer exists, see {@link serializeAllowEntries}.
   */
  knownBlockNames: Set<string>;
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
 * Narrows a component's wire `schema` to the field-record shape that
 * `sortSchemaByPos` accepts. Allows graceful handling of malformed schema: a
 * field whose value is not a record is dropped by the caller's own filter.
 */
function isFieldRecordMap(value: unknown): value is Record<string, Record<string, unknown>> {
  return isRecord(value) && Object.values(value).every((field) => isRecord(field));
}

/** Field types whose `allow` list the wire actually uses to restrict blocks. */
const BLOCK_RESTRICTED_FIELD_TYPES = new Set(["bloks", "richtext"]);

/**
 * Serializes one `allow` entry: a bare block name, or a folder reference. Any
 * other shape yields `undefined`, which drops the whole `allow` (no narrowing
 * is safer than wrong narrowing).
 */
function serializeAllowEntry(entry: unknown): string | undefined {
  if (typeof entry === "string") {
    return quoteString(entry);
  }
  if (isRecord(entry) && typeof entry.folder === "string") {
    return `{ folder: ${quoteString(entry.folder)} }`;
  }
  return undefined;
}

/**
 * Serializes a field's `allow` list, or returns `undefined` to emit no `allow`
 * at all.
 *
 * Names that no component in the space answers to are dropped. `ApplyAllow` is
 * an `Extract`, so an unmatched name contributes nothing to the union and a list
 * of only unmatched names would resolve the field to `never[]`, rejecting every
 * possible value. Storyblok does clean whitelists when a component is deleted
 * (`CleanComponentSchemaJob`), but that job is eventual, is skipped for
 * non-nestable components, and never runs at all for schemas imported or
 * hand-written through the API, so stale names do reach this code.
 *
 * Folder entries are resolved all-or-nothing upstream in `toDslField`, so they
 * are already known-good by the time they arrive here.
 */
function serializeAllowEntries(allow: unknown[], knownBlockNames: Set<string>): string | undefined {
  const known = allow.filter((entry) => typeof entry !== "string" || knownBlockNames.has(entry));
  if (known.length === 0) {
    return undefined;
  }

  const entries = known.map(serializeAllowEntry);
  if (!entries.every((entry): entry is string => entry !== undefined)) {
    return undefined;
  }
  return `allow: [${entries.join(", ")}]`;
}

/**
 * Decides whether a field's whitelist actually restricts which blocks it
 * accepts, and so whether `allow` belongs in the emitted type.
 *
 * Two independent reasons to emit nothing:
 *
 * `restrict_components: false` means the restriction is switched off, and the
 * app treats it that way, so the whitelist beside it is inert. Storyblok strips
 * name whitelists when the flag is false, but never strips
 * `component_group_whitelist`, so a field restricted to a folder with the
 * restriction disabled is a persistable state that would otherwise narrow the
 * type against blocks the editor happily accepts. A *missing* flag is not the
 * same as `false`: the backend enforces the whitelist in that case, so
 * narrowing stays correct.
 *
 * Only `bloks` and `richtext` fields restrict *blocks*. On a `multilink`,
 * `component_whitelist` holds content type names and on other field types the
 * key is meaningless, so emitting `allow` there would put a misleading list in
 * a file the user reads. The type level ignores it either way.
 */
function isRestrictedByBlocks(
  fieldData: Record<string, unknown>,
  dsl: Record<string, unknown>,
): boolean {
  if (fieldData.restrict_components === false) {
    return false;
  }
  return typeof dsl.type === "string" && BLOCK_RESTRICTED_FIELD_TYPES.has(dsl.type);
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
  if (typeof dsl.type === "string") {
    members.push(`type: ${quoteString(dsl.type)}`);
  }
  if (dsl.required === true) {
    members.push("required: true");
  }

  if (isRestrictedByBlocks(fieldData, dsl) && Array.isArray(dsl.allow) && dsl.allow.length > 0) {
    const allow = serializeAllowEntries(dsl.allow, context.knownBlockNames);
    if (allow !== undefined) {
      members.push(allow);
    }
  }

  const customFieldType =
    dsl.type === "custom" && typeof dsl.field_type === "string" ? dsl.field_type : undefined;
  if (customFieldType !== undefined) {
    members.push(`field_type: ${quoteString(customFieldType)}`);
  }

  return {
    code: `{ ${members.join("; ")} }`,
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
export function serializeBlockDefinition(
  component: Component,
  context: SerializeContext,
): SerializedBlock {
  const lines = ["{"];
  lines.push(`${INDENT}readonly id: number;`);
  lines.push(`${INDENT}created_at: string;`);
  lines.push(`${INDENT}updated_at: string;`);
  lines.push(`${INDENT}name: ${quoteString(component.name)};`);
  lines.push(`${INDENT}is_root: ${component.is_root === true ? "true" : "false"};`);
  lines.push(`${INDENT}is_nestable: ${component.is_nestable === false ? "false" : "true"};`);

  const groupUuid = component.component_group_uuid;
  const folderPath =
    typeof groupUuid === "string" ? context.displayPathByUuid.get(groupUuid) : undefined;
  if (folderPath !== undefined) {
    lines.push(`${INDENT}folder: ${quoteString(folderPath)};`);
  }

  const schema = isFieldRecordMap(component.schema) ? component.schema : {};
  const fields = sortSchemaByPos(schema).filter(([, data]) => isRecord(data));

  const customFieldTypes: string[] = [];
  if (fields.length === 0) {
    lines.push(`${INDENT}fields: [];`);
  } else {
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

  lines.push("}");

  return { componentName: component.name, definitionBody: lines.join("\n"), customFieldTypes };
}

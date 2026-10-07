import { isRecord } from "../utils/is-record";
import { generateFieldCode, resolveFieldRestriction, sortSchemaByPos } from "./field";
import { INDENT, quoteString } from "./format";
import { componentVarName, resolveVarNames } from "./names";

/** A component as the Management API returns it; only the keys a snapshot reads. */
export type WireComponent = {
  name: string;
  schema?: Record<string, unknown> | null;
  is_root?: boolean;
  is_nestable?: boolean;
  component_group_uuid?: string | null;
  internal_tag_ids?: readonly (string | number)[] | null;
};

export type GenerateSnapshotOptions = {
  /** Every component in the space, as it stands before the migration. */
  components: readonly WireComponent[];
  /** The blocks the migration reads into. Unknown names are skipped. */
  reads: readonly string[];
  /** Named in the header comment. */
  migrationId?: string;
};

/** Field types whose restriction lists name the blocks that may nest in them. */
const NESTING_FIELD_TYPES = new Set(["bloks", "richtext"]);
const OPTION_FIELD_TYPES = new Set(["option", "options"]);

type FieldRecord = Record<string, unknown>;

function fieldsOf(component: WireComponent): [string, FieldRecord][] {
  return isRecord(component.schema)
    ? sortSchemaByPos(component.schema as Record<string, FieldRecord>)
    : [];
}

/**
 * The block names a nesting field's allow list resolves to, or `undefined` when
 * no allow list is in force. Folder and tag restrictions are resolved to the
 * blocks currently in that folder or carrying that tag. A denylist resolves to
 * `undefined` too: it admits every block it does not name, and following it
 * would drag the whole space into the snapshot.
 */
function allowedBlockNames(
  field: FieldRecord,
  components: readonly WireComponent[],
): string[] | undefined {
  if (!NESTING_FIELD_TYPES.has(String(field.type))) {
    return undefined;
  }
  // Identity maps make the shared resolver hand back the raw uuids and tag ids
  // instead of `defineFolder` refs and tag names.
  const groupUuids = new Map<string, string>();
  const tagIds = new Map<string, string>();
  for (const component of components) {
    if (component.component_group_uuid) {
      groupUuids.set(component.component_group_uuid, component.component_group_uuid);
    }
    for (const id of component.internal_tag_ids ?? []) {
      tagIds.set(String(id), String(id));
    }
  }
  const restriction = resolveFieldRestriction(field, groupUuids, tagIds);
  switch (restriction.kind) {
    case "names":
      return Array.isArray(restriction.allow) ? restriction.allow.map(String) : undefined;
    case "folders": {
      const uuids = new Set(restriction.allow?.map((ref) => ref.code));
      return uuids.size === 0
        ? undefined
        : components
            .filter((c) => c.component_group_uuid && uuids.has(c.component_group_uuid))
            .map((c) => c.name);
    }
    case "tagRefs": {
      const ids = new Set(restriction.allow?.map((ref) => ref.tag));
      return ids.size === 0
        ? undefined
        : components
            .filter((c) => (c.internal_tag_ids ?? []).some((id) => ids.has(String(id))))
            .map((c) => c.name);
    }
    default:
      return undefined;
  }
}

/**
 * Keeps only the keys that shape a field's content type. A space holds options
 * the editor no longer writes, in shapes `defineField` rejects; the snapshot
 * types content, so it drops them rather than failing to compile. Restrictions
 * become a plain block-name allow list.
 */
function typingField(field: FieldRecord, allowed: string[] | undefined): FieldRecord {
  const typed: FieldRecord = { type: field.type };
  if (field.required === true) {
    typed.required = true;
  }
  const isOptionField = OPTION_FIELD_TYPES.has(String(field.type));
  if (isOptionField && typeof field.source === "string" && field.source !== "") {
    typed.source = field.source;
  }
  if (field.type === "custom" && typeof field.field_type === "string") {
    typed.field_type = field.field_type;
  }
  if (isOptionField && Array.isArray(field.options)) {
    typed.options = field.options.filter(isRecord).map((option) => ({
      name: String(option.name ?? option.value),
      value: String(option.value),
    }));
  }
  if (allowed && allowed.length > 0) {
    typed.component_whitelist = allowed;
  }
  return typed;
}

/**
 * Generates a `.before.ts` module: the schema as it stood before a migration,
 * exporting `type Before` for `defineMigration<After, Before>`.
 *
 * Only the blocks the migration reads into are emitted with their fields.
 * Every other block reachable from them through an allow list, transitively, is
 * a name-only stub: enough to keep nested `bloks` fields typed, while keeping
 * the file small on a space where one section whitelists most of the schema.
 */
export function generateSnapshot(options: GenerateSnapshotOptions): string {
  const { components, migrationId } = options;
  const byName = new Map(components.map((c) => [c.name, c]));
  const reads = [...new Set(options.reads)].filter((name) => byName.has(name)).sort();
  const allowedByField = new Map<FieldRecord, string[] | undefined>();

  const reached = new Set(reads);
  const queue = [...reads];
  while (queue.length > 0) {
    const component = byName.get(queue.shift() as string) as WireComponent;
    for (const [, field] of fieldsOf(component)) {
      const allowed = allowedBlockNames(field, components);
      allowedByField.set(field, allowed);
      for (const name of allowed ?? []) {
        if (byName.has(name) && !reached.has(name)) {
          reached.add(name);
          queue.push(name);
        }
      }
    }
  }

  const stubs = [...reached].filter((name) => !reads.includes(name)).sort();
  const ordered = [...reads, ...stubs];
  const varNames = resolveVarNames(ordered, componentVarName);
  const hasFields = reads.some((name) => fieldsOf(byName.get(name) as WireComponent).length > 0);

  const lines: string[] = [
    "/**",
    migrationId
      ? ` * The schema as it stood before migration ${migrationId}.`
      : " * The schema as it stood before the migration beside it.",
    " * Generated: blocks the migration reads into carry their fields, and the",
    " * blocks reachable from them are name-only stubs. Frozen once shipped, so",
    " * the migration keeps typechecking after the schema moves on.",
    " */",
    `import { defineBlock, ${hasFields ? "defineField, " : ""}defineSchema } from '@storyblok/schema';`,
    "import type { Schema } from '@storyblok/schema';",
    "",
  ];

  ordered.forEach((name, i) => {
    if (!reads.includes(name)) {
      lines.push(`const ${varNames[i]} = defineBlock({ name: ${quoteString(name)}, fields: [] });`);
      return;
    }
    const component = byName.get(name) as WireComponent;
    lines.push(`const ${varNames[i]} = defineBlock({`);
    lines.push(`${INDENT}name: ${quoteString(name)},`);
    if (component.is_root !== undefined) {
      lines.push(`${INDENT}is_root: ${component.is_root},`);
    }
    if (component.is_nestable !== undefined) {
      lines.push(`${INDENT}is_nestable: ${component.is_nestable},`);
    }
    const fields = fieldsOf(component);
    if (fields.length === 0) {
      lines.push(`${INDENT}fields: [],`);
    } else {
      lines.push(`${INDENT}fields: [`);
      for (const [fieldName, field] of fields) {
        const typed = typingField(field, allowedByField.get(field));
        lines.push(`${INDENT}${INDENT}${generateFieldCode(fieldName, typed, 2)},`);
      }
      lines.push(`${INDENT}],`);
    }
    lines.push("});", "");
  });

  if (stubs.length > 0) {
    lines.push("");
  }
  lines.push("const schema = defineSchema({");
  lines.push(`${INDENT}blocks: {`);
  for (const varName of varNames) {
    lines.push(`${INDENT}${INDENT}${varName},`);
  }
  lines.push(`${INDENT}},`);
  lines.push("});", "");
  lines.push("export type Before = Schema<typeof schema>;", "");

  return lines.join("\n");
}

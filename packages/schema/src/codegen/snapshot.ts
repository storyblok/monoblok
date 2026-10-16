import { isRecord } from "../utils/is-record";
import {
  generateFieldCode,
  RESTRICTABLE_FIELD_TYPES,
  resolveFieldRestriction,
  sortSchemaByPos,
} from "./field";
import { commentText, INDENT, quoteString } from "./format";
import { componentVarName, resolveVarNames } from "./names";

/** A component as the Management API returns it; only the keys a snapshot reads. */
export type WireComponent = {
  name: string;
  schema?: Record<string, unknown> | null;
  is_root?: boolean | null;
  is_nestable?: boolean | null;
  component_group_uuid?: string | null;
  internal_tag_ids?: readonly (string | number)[] | null;
};

export type GenerateSnapshotOptions = {
  /** Every component in the space, as it stands before the migration. */
  components: readonly WireComponent[];
  /** The blocks the migration reads, emitted with their fields. Unknown names are skipped. */
  blocks: readonly string[];
  /** Named in the header comment. */
  migrationId?: string;
};

const OPTION_FIELD_TYPES = new Set(["option", "options"]);
const SNAPSHOT_IMPORTS = ["defineBlock", "defineField", "defineSchema", "Schema"];

type FieldRecord = Record<string, unknown> & { type: string };

function isFieldRecord(value: unknown): value is FieldRecord {
  return isRecord(value) && typeof value.type === "string";
}

/** The component's fields in editor order, skipping entries that are not field records. */
function fieldsOf(component: WireComponent | undefined): [string, FieldRecord][] {
  if (!component || !isRecord(component.schema)) {
    return [];
  }
  const fields = Object.entries(component.schema).filter((entry): entry is [string, FieldRecord] =>
    isFieldRecord(entry[1]),
  );
  return sortSchemaByPos(Object.fromEntries(fields));
}

type RestrictionLookup = {
  components: readonly WireComponent[];
  groupUuids: Map<string, string>;
  tagIds: Map<string, string>;
};

/**
 * Identity maps make the shared resolver hand back the raw uuids and tag ids
 * instead of `defineFolder` refs and tag names.
 */
function restrictionLookup(components: readonly WireComponent[]): RestrictionLookup {
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
  return { components, groupUuids, tagIds };
}

/**
 * The block names a nesting field's allow list resolves to, or `undefined` when
 * no allow list is in force. Folder and tag restrictions are resolved to the
 * blocks currently in that folder or carrying that tag. A denylist resolves to
 * `undefined` too: it admits every block it does not name.
 */
function allowedBlockNames(field: FieldRecord, lookup: RestrictionLookup): string[] | undefined {
  const { components, groupUuids, tagIds } = lookup;
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

type NestingField = { field: FieldRecord; allowed: string[] | undefined };

function nestingFieldsOf(
  component: WireComponent | undefined,
  lookup: RestrictionLookup,
): NestingField[] {
  return fieldsOf(component)
    .filter(([, field]) => RESTRICTABLE_FIELD_TYPES.has(field.type))
    .map(([, field]) => ({ field, allowed: allowedBlockNames(field, lookup) }));
}

/**
 * Blocks that can hold one of `blocks` at any depth, so `under` can name them.
 * A `bloks` field without an allow list can hold every block. A `richtext`
 * field without one is left out: most blocks of a space have one, so counting
 * them would stub nearly the whole space into every snapshot.
 */
function containersOf(
  blocks: readonly string[],
  components: readonly WireComponent[],
  lookup: RestrictionLookup,
): Set<string> {
  const nesting = new Map(components.map((c) => [c.name, nestingFieldsOf(c, lookup)]));
  const contained = new Set(blocks);
  const containers = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, fields] of nesting) {
      if (containers.has(name)) continue;
      const holds = fields.some(({ field, allowed }) =>
        allowed ? allowed.some((child) => contained.has(child)) : field.type === "bloks",
      );
      if (holds) {
        containers.add(name);
        contained.add(name);
        grew = true;
      }
    }
  }
  return containers;
}

/**
 * Keeps only the keys that shape a field's content type. A space holds options
 * the editor no longer writes, in shapes `defineField` rejects; the snapshot
 * types content, so it drops them rather than failing to compile. Restrictions
 * become a plain block-name allow list.
 */
function typingField(field: FieldRecord, allowed: string[] | undefined): Record<string, unknown> {
  const typed: Record<string, unknown> = { type: field.type };
  if (field.required === true) {
    typed.required = true;
  }
  const isOptionField = OPTION_FIELD_TYPES.has(field.type);
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

const MAX_LINE_LENGTH = 80;

/** Packs list items onto as few lines as fit, each line indented and every item comma-terminated. */
function wrapList(items: readonly string[], indent: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const item of items) {
    const next = line ? `${line} ${item},` : `${indent}${item},`;
    if (line && next.length > MAX_LINE_LENGTH) {
      lines.push(line);
      line = `${indent}${item},`;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Generates a `.before.ts` module: the schema as it stood before a migration,
 * exporting `type Before` for `defineMigration<Schema, Before>`.
 *
 * Only `blocks` are emitted with their fields. Name-only stubs cover the blocks
 * their fields allow, which keeps nested `bloks` fields typed, and every block
 * that can contain one of them, so `under` can name it. `nameOnlyBlocks` names
 * every block not emitted with its fields, so a check against the snapshot can
 * tell an existing block from a new one.
 */
export function generateSnapshot(options: GenerateSnapshotOptions): string {
  const { components, migrationId } = options;
  const byName = new Map(components.map((c) => [c.name, c]));
  const blocks = [...new Set(options.blocks)].filter((name) => byName.has(name)).sort();
  const lookup = restrictionLookup(components);

  const allowedByField = new Map<FieldRecord, string[] | undefined>();
  const stubNames = new Set<string>();
  for (const name of blocks) {
    for (const { field, allowed } of nestingFieldsOf(byName.get(name), lookup)) {
      allowedByField.set(field, allowed);
      for (const child of allowed ?? []) {
        if (byName.has(child)) stubNames.add(child);
      }
    }
  }
  for (const container of containersOf(blocks, components, lookup)) {
    stubNames.add(container);
  }

  const stubs = [...stubNames].filter((name) => !blocks.includes(name)).sort();
  const ordered = [...blocks, ...stubs];
  const varNames = resolveVarNames(ordered, componentVarName, SNAPSHOT_IMPORTS);
  const hasFields = blocks.some((name) => fieldsOf(byName.get(name)).length > 0);

  const lines: string[] = [
    "/**",
    migrationId
      ? ` * The schema as it stood before migration ${commentText(migrationId)}.`
      : " * The schema as it stood before the migration beside it.",
    " * Generated. Blocks the migration reads list their fields; the blocks around",
    " * them are name-only stubs. Keep this file unchanged once the migration ships,",
    " * so the fields it reads stay typed after later schema changes.",
    " */",
  ];
  const valueImports = [
    ...(ordered.length > 0 ? ["defineBlock"] : []),
    ...(hasFields ? ["defineField"] : []),
    "defineSchema",
  ];
  lines.push(
    `import { ${valueImports.join(", ")} } from '@storyblok/schema';`,
    "import type { Schema } from '@storyblok/schema';",
    "",
  );

  ordered.forEach((name, i) => {
    if (!blocks.includes(name)) {
      lines.push(`const ${varNames[i]} = defineBlock({ name: ${quoteString(name)}, fields: [] });`);
      return;
    }
    const component = byName.get(name);
    lines.push(`const ${varNames[i]} = defineBlock({`);
    lines.push(`${INDENT}name: ${quoteString(name)},`);
    if (typeof component?.is_root === "boolean") {
      lines.push(`${INDENT}is_root: ${component.is_root},`);
    }
    if (typeof component?.is_nestable === "boolean") {
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
  lines.push("export const schema = defineSchema({");
  lines.push(`${INDENT}blocks: {`);
  for (const varName of varNames) {
    lines.push(`${INDENT}${INDENT}${varName},`);
  }
  lines.push(`${INDENT}},`);
  lines.push("});", "");
  lines.push("export type Before = Schema<typeof schema>;", "");

  const nameOnlyBlocks = components
    .map((component) => component.name)
    .filter((name) => !blocks.includes(name))
    .sort();
  lines.push(
    "/** Blocks in the space whose fields are not part of this snapshot. */",
    nameOnlyBlocks.length === 0
      ? "export const nameOnlyBlocks: string[] = [];"
      : [
          "export const nameOnlyBlocks: string[] = [",
          ...wrapList(nameOnlyBlocks.map(quoteString), INDENT),
          "];",
        ].join("\n"),
    "",
  );

  return lines.join("\n");
}

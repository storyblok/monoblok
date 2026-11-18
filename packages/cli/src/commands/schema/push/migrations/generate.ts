import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import type { MigrationOpSource } from "@storyblok/schema/internal/codegen";
import {
  coercionBetween,
  commentText,
  isIdentifier,
  quoteString,
} from "@storyblok/schema/internal/codegen";

import { resolvePath } from "../../../../utils/filesystem";
import { buildMigrationFilename } from "../../../migrations/migration-filename";
import { fileTimestamp } from "../../utils";
import type { BreakingChange, ComponentBreakingChanges } from "./types";

/** Compatible type pairs that don't need a content migration. */
const COMPATIBLE_TYPES = new Set(["text:textarea", "textarea:text"]);

/** Returns a safe default literal for a Storyblok field type, or null if no safe default exists. */
function defaultForType(fieldType: string): string | null {
  switch (fieldType) {
    case "text":
    case "textarea":
    case "markdown":
      return `''`;
    case "number":
      return "0";
    case "boolean":
      return "false";
    default:
      return null;
  }
}

/** A property access on `block` that stays one expression whatever the field name holds. */
function accessor(field: string): string {
  return isIdentifier(field) ? `block.${field}` : `block[${quoteString(field)}]`;
}

/** Returns a conversion expression for a type change, or null if compatible. */
function typeConversion(field: string, oldType: string, newType: string): string | null {
  const key = `${oldType}:${newType}`;
  if (COMPATIBLE_TYPES.has(key)) {
    return null;
  }

  const target = accessor(field);
  switch (key) {
    case "text:number":
      return `${target} = Number(${target}) || 0;`;
    case "number:text":
      return `${target} = String(${target});`;
    case "text:boolean":
      return `${target} = !!${target};`;
    case "boolean:text":
      return `${target} = String(${target});`;
    default:
      return `${target}; // ${commentText(`TODO: convert from ${oldType} to ${newType}`)}`;
  }
}

/**
 * Renders a migration function body from a list of breaking changes.
 * Returns a complete migration file content string.
 */
export function renderMigrationCode(changes: BreakingChange[]): string {
  const lines: string[] = [];
  // Names, types, and option values come from the space, so they pass through
  // `commentText` or `quoteString` before they reach the file.
  const code = (text: string) => lines.push(`  ${text}`);
  const comment = (text: string) => lines.push(`  // ${commentText(text)}`);

  comment("Review this migration before running it against your space.");
  comment("Generated migrations are scaffolds and may need manual adjustments.");
  comment("Example rename migration:");
  comment("block.new_field = block.old_field;");
  comment("delete block.old_field;");
  lines.push("");

  for (const change of changes) {
    switch (change.kind) {
      case "rename": {
        const from = accessor(change.oldField);
        comment(`Rename: ${change.oldField} → ${change.field}`);
        code(`if (${quoteString(change.oldField)} in block) {`);
        code(`  ${accessor(change.field)} = ${from};`);
        code(`  delete ${from};`);
        code(`}`);
        break;
      }

      case "removed":
        if (change.renameHint) {
          for (const newField of change.renameHint.newFields) {
            comment(`If '${change.field}' was renamed to '${newField}', uncomment:`);
            comment(`${accessor(newField)} = ${accessor(change.field)};`);
          }
        } else {
          comment(`Removed field: ${change.field}`);
        }
        code(`delete ${accessor(change.field)};`);
        break;

      case "type_changed": {
        const conversion = typeConversion(change.field, change.oldType, change.newType);
        if (conversion) {
          comment(`Type change: ${change.field} (${change.oldType} → ${change.newType})`);
          code(conversion);
        }
        break;
      }

      case "required_added":
      case "required_changed": {
        const target = accessor(change.field);
        const defaultValue = defaultForType(change.fieldType);
        if (change.kind === "required_added") {
          comment(`New required field: ${change.field} (${change.fieldType})`);
        } else {
          comment(`Field is now required: ${change.field} (${change.fieldType})`);
          comment(`Existing stories may have null/undefined values — provide a default for those.`);
        }
        if (defaultValue !== null) {
          comment(`TODO: provide a meaningful default value`);
          code(`${target} = ${target} ?? ${defaultValue};`);
        } else {
          comment(`TODO: provide a default value appropriate for the '${change.fieldType}' type`);
          comment(`${target} = ${target} ?? <default>;`);
        }
        break;
      }

      case "options_removed": {
        const target = accessor(change.field);
        const values = change.values.map(quoteString);
        comment(`Options no longer offered by ${change.field}: ${values.join(", ")}`);
        comment(`TODO: map each removed value to one the field still offers`);
        for (const value of values) {
          comment(
            change.multiple
              ? `${target} = ${target}?.map((value) => (value === ${value} ? <value> : value));`
              : `if (${target} === ${value}) ${target} = <value>;`,
          );
        }
        break;
      }
    }

    lines.push("");
  }

  const body = lines.length > 0 ? `\n${lines.join("\n")}` : "\n";

  return `export default function (block) {${body}  return block;\n}\n`;
}

/** A Storyblok `number` field stores its value as a string, so `""` is empty there too. */
const STRING_STORED_FIELD_TYPES = new Set(["text", "textarea", "markdown", "number"]);

/** `false` is the only default every required field of its type accepts. */
function requiredDefaultFor(fieldType: string): false | undefined {
  return fieldType === "boolean" ? false : undefined;
}

function defaultTodo(field: string, fieldType: string, value: unknown): string {
  return value === undefined
    ? `TODO: provide a default for the required ${fieldType} field '${field}'.`
    : `TODO: replace the placeholder default for the required field '${field}'.`;
}

/**
 * A new field that isn't required has no op, so a rename onto it replaces only
 * the removeField; a new required field has an addField to replace as well.
 */
function renameHintTodo(field: string, newFields: string[], changes: BreakingChange[]): string {
  const withAddField = new Set(
    changes.flatMap((change) => (change.kind === "required_added" ? [change.field] : [])),
  );
  const withoutOp = newFields.filter((newField) => !withAddField.has(newField));
  const clauses = [
    ...(withoutOp.length > 0
      ? [
          `renamed to ${withoutOp.map((newField) => `'${newField}'`).join(" or ")}, replace this removeField with renameField`,
        ]
      : []),
    ...newFields
      .filter((newField) => withAddField.has(newField))
      .map(
        (newField) =>
          `renamed to '${newField}', replace this removeField and the addField of '${newField}' with renameField`,
      ),
  ];
  const [first, ...rest] = clauses;
  const conditions = [`if '${field}' was ${first}`, ...rest.map((clause) => `if it was ${clause}`)];
  return rest.length === 0
    ? `TODO: ${conditions[0]}, or the content of '${field}' is lost.`
    : `TODO: ${conditions.join("; ")}. Otherwise, the content of '${field}' is lost.`;
}

export function toMigrationOps(block: string, changes: BreakingChange[]): MigrationOpSource[] {
  return changes.flatMap((change): MigrationOpSource[] => {
    switch (change.kind) {
      case "rename":
        return [{ kind: "renameField", block, field: change.oldField, to: change.field }];
      case "removed":
        return [
          {
            kind: "removeField",
            block,
            field: change.field,
            todo: change.renameHint
              ? [renameHintTodo(change.field, change.renameHint.newFields, changes)]
              : undefined,
          },
        ];
      case "type_changed": {
        const coercion = coercionBetween(change.oldType, change.newType);
        if (coercion) {
          return [{ kind: "coerceField", block, field: change.field, ...coercion }];
        }
        return [
          {
            kind: "alterField",
            block,
            field: change.field,
            todo: [
              `TODO: convert '${change.field}' from ${change.oldType} to ${change.newType}. A rerun passes already-converted values.`,
            ],
          },
        ];
      }
      case "options_removed":
        return [
          {
            kind: "alterField",
            block,
            field: change.field,
            removedValues: change.values,
            multiple: change.multiple,
            todo: [
              `TODO: map the values '${change.field}' no longer offers to ones it does. A rerun passes already-mapped values.`,
            ],
          },
        ];
      case "required_added": {
        const value = requiredDefaultFor(change.fieldType);
        return [
          {
            kind: "addField",
            block,
            field: change.field,
            value,
            todo: [defaultTodo(change.field, change.fieldType, value)],
          },
        ];
      }
      case "required_changed": {
        const value = requiredDefaultFor(change.fieldType);
        return [
          {
            kind: "fillField",
            block,
            field: change.field,
            value,
            fillEmptyString: STRING_STORED_FIELD_TYPES.has(change.fieldType),
            todo: [defaultTodo(change.field, change.fieldType, value)],
          },
        ];
      }
    }
  });
}

function describeChange(change: BreakingChange): string {
  switch (change.kind) {
    case "rename":
      return `rename ${change.oldField} to ${change.field}`;
    case "removed":
      return `remove ${change.field}`;
    case "type_changed":
      return `convert ${change.field} to ${change.newType}`;
    case "required_added":
      return `add ${change.field}`;
    case "required_changed":
      return `require ${change.field}`;
    case "options_removed":
      return `remove options from ${change.field}`;
  }
}

const MAX_TITLE_LENGTH = 100;

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

/**
 * The title of a typed migration: its changes by block, or only the blocks
 * when the changes don't fit.
 */
export function migrationTitle(changes: readonly ComponentBreakingChanges[]): string {
  const blocks = changes.map((comp) => comp.componentName);
  const detailed = `Update ${changes
    .map((comp) => `${comp.componentName}: ${comp.changes.map(describeChange).join(", ")}`)
    .join("; ")}`;
  return detailed.length <= MAX_TITLE_LENGTH ? detailed : `Update ${listFormat.format(blocks)}`;
}

/** Options for writing a migration file. */
export interface WriteMigrationFileOptions {
  spaceId: string;
  componentName: string;
  code: string;
  timestamp: string;
  basePath?: string;
}

/**
 * Writes a migration file to disk.
 * @returns The absolute path to the written file.
 */
export async function writeMigrationFile(options: WriteMigrationFileOptions): Promise<string> {
  const { spaceId, componentName, code, timestamp, basePath } = options;
  const dir = resolvePath(basePath, `migrations/${spaceId}`);
  await mkdir(dir, { recursive: true });
  const fileName = buildMigrationFilename(componentName, fileTimestamp(timestamp));
  const filePath = join(dir, fileName);
  await writeFile(filePath, code, "utf-8");
  return filePath;
}

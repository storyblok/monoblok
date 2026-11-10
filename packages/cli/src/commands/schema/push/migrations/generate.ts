import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import type { MigrationOpSource } from "@storyblok/schema/codegen";
import { coercionBetween } from "@storyblok/schema/internal/codegen";

import { resolvePath } from "../../../../utils/filesystem";
import { fileTimestamp } from "../../utils";
import type { BreakingChange } from "./types";

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

/** Returns a conversion expression for a type change, or null if compatible. */
function typeConversion(field: string, oldType: string, newType: string): string | null {
  const key = `${oldType}:${newType}`;
  if (COMPATIBLE_TYPES.has(key)) {
    return null;
  }

  const accessor = `block.${field}`;
  switch (key) {
    case "text:number":
      return `${accessor} = Number(${accessor}) || 0;`;
    case "number:text":
      return `${accessor} = String(${accessor});`;
    case "text:boolean":
      return `${accessor} = !!${accessor};`;
    case "boolean:text":
      return `${accessor} = String(${accessor});`;
    default:
      return `${accessor}; // TODO: convert from ${oldType} to ${newType}`;
  }
}

/**
 * Renders a migration function body from a list of breaking changes.
 * Returns a complete migration file content string.
 */
export function renderMigrationCode(changes: BreakingChange[]): string {
  const lines: string[] = [];

  lines.push("  // Review this migration before running it against your space.");
  lines.push("  // Generated migrations are scaffolds and may need manual adjustments.");
  lines.push("  // Example rename migration:");
  lines.push("  // block.new_field = block.old_field;");
  lines.push("  // delete block.old_field;");
  lines.push("");

  for (const change of changes) {
    switch (change.kind) {
      case "rename":
        lines.push(`  // Rename: ${change.oldField} → ${change.field}`);
        lines.push(`  if ('${change.oldField}' in block) {`);
        lines.push(`    block.${change.field} = block.${change.oldField};`);
        lines.push(`    delete block.${change.oldField};`);
        lines.push(`  }`);
        break;

      case "removed":
        if (change.renameHint) {
          for (const newField of change.renameHint.newFields) {
            lines.push(`  // If '${change.field}' was renamed to '${newField}', uncomment:`);
            lines.push(`  // block.${newField} = block.${change.field};`);
          }
        } else {
          lines.push(`  // Removed field: ${change.field}`);
        }
        lines.push(`  delete block.${change.field};`);
        break;

      case "type_changed": {
        const conversion = typeConversion(change.field, change.oldType, change.newType);
        if (conversion) {
          lines.push(`  // Type change: ${change.field} (${change.oldType} → ${change.newType})`);
          lines.push(`  ${conversion}`);
        }
        break;
      }

      case "required_added": {
        const defaultValue = defaultForType(change.fieldType);
        lines.push(`  // New required field: ${change.field} (${change.fieldType})`);
        if (defaultValue !== null) {
          lines.push(`  // TODO: provide a meaningful default value`);
          lines.push(`  block.${change.field} = block.${change.field} ?? ${defaultValue};`);
        } else {
          lines.push(
            `  // TODO: provide a default value appropriate for the '${change.fieldType}' type`,
          );
          lines.push(`  // block.${change.field} = block.${change.field} ?? <default>;`);
        }
        break;
      }

      case "block_renamed":
        lines.push(`  // Block renamed: ${change.from} → ${change.to}`);
        lines.push(`  block.component = '${change.to}';`);
        break;

      case "options_removed": {
        const values = change.values.map((value) => JSON.stringify(value)).join(", ");
        lines.push(`  // Options no longer offered by ${change.field}: ${values}`);
        lines.push(`  // TODO: map each removed value to one the field still offers`);
        for (const value of change.values.map((value) => JSON.stringify(value))) {
          lines.push(
            change.multiple
              ? `  // block.${change.field} = block.${change.field}?.map((value) => (value === ${value} ? <value> : value));`
              : `  // if (block.${change.field} === ${value}) block.${change.field} = <value>;`,
          );
        }
        break;
      }

      case "required_changed": {
        const defaultValue = defaultForType(change.fieldType);
        lines.push(`  // Field is now required: ${change.field} (${change.fieldType})`);
        lines.push(
          `  // Existing stories may have null/undefined values — provide a default for those.`,
        );
        if (defaultValue !== null) {
          lines.push(`  // TODO: provide a meaningful default value`);
          lines.push(`  block.${change.field} = block.${change.field} ?? ${defaultValue};`);
        } else {
          lines.push(
            `  // TODO: provide a default value appropriate for the '${change.fieldType}' type`,
          );
          lines.push(`  // block.${change.field} = block.${change.field} ?? <default>;`);
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
      case "block_renamed":
        return [{ kind: "renameBlock", block, to: change.to }];
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
  const fileName = `${componentName}.${fileTimestamp(timestamp)}.js`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, code, "utf-8");
  return filePath;
}

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "pathe";
import type { MigrationOpSource } from "@storyblok/schema/codegen";
import type { CoercionTarget } from "@storyblok/schema/migrations";

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
          lines.push(
            `  // If '${change.field}' was renamed to '${change.renameHint.newField}', uncomment:`,
          );
          lines.push(`  // block.${change.renameHint.newField} = block.${change.field};`);
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

/** Field types whose values `coerceField` converts between. */
const COERCION_TARGETS: Record<string, CoercionTarget> = {
  text: "string",
  textarea: "string",
  markdown: "string",
  number: "number",
  boolean: "boolean",
};

/** The empty value a new required field is backfilled with. */
function defaultValueForType(fieldType: string): unknown {
  switch (fieldType) {
    case "text":
    case "textarea":
    case "markdown":
    case "number":
      // A Storyblok `number` field stores its value as a string.
      return "";
    case "boolean":
      return false;
    default:
      return undefined;
  }
}

function defaultTodo(field: string, fieldType: string, value: unknown): string {
  return value === undefined
    ? `TODO: provide a default for the required ${fieldType} field '${field}'.`
    : `TODO: replace the placeholder default for the required field '${field}'.`;
}

/** Maps one component's breaking changes to `defineMigration` ops. */
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
              ? [
                  `If '${change.field}' was renamed to '${change.renameHint.newField}', use renameField instead.`,
                ]
              : undefined,
          },
        ];
      case "type_changed": {
        if (COMPATIBLE_TYPES.has(`${change.oldType}:${change.newType}`)) {
          return [];
        }
        const from = COERCION_TARGETS[change.oldType];
        const to = COERCION_TARGETS[change.newType];
        return from && to
          ? [{ kind: "coerceField", block, field: change.field, from, to }]
          : [
              {
                kind: "alterField",
                block,
                field: change.field,
                todo: [
                  `TODO: convert '${change.field}' from ${change.oldType} to ${change.newType}.`,
                ],
              },
            ];
      }
      case "required_added": {
        const value = defaultValueForType(change.fieldType);
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
        const value = defaultValueForType(change.fieldType);
        return [
          {
            kind: "fillField",
            block,
            field: change.field,
            value,
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

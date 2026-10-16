import type { CoercionTarget } from "../migrations/ops";
import { isRecord } from "../utils/is-record";
import { commentText, formatValue, INDENT, quoteString } from "./format";

type OpTarget = { block: string; field: string };

/**
 * A migration op described as data, rendered to the matching call from
 * `@storyblok/schema/migrations`. `todo` lines are emitted as comments above
 * the call. An op whose callback the generator cannot write gets one that
 * throws, so `migrations apply` refuses the op until the author replaces it.
 */
export type MigrationOpSource = { todo?: readonly string[] } & (
  | (OpTarget & { kind: "renameField"; to: string })
  | (OpTarget & { kind: "removeField" })
  | (OpTarget & { kind: "coerceField"; from?: CoercionTarget; to: CoercionTarget })
  | (OpTarget & { kind: "alterField" })
  /** Backfills absent keys with `value`. */
  | (OpTarget & { kind: "addField"; value?: unknown })
  /**
   * Fills an absent or `null` field, and `""` with `fillEmptyString`, with
   * `value`. Translations are left as they are.
   */
  | (OpTarget & { kind: "fillField"; value?: unknown; fillEmptyString?: boolean })
);

export type GenerateMigrationSourceOptions = {
  /** Module specifier of the schema entry; it must export `type Schema`. */
  schemaImport: string;
  /** Module specifier of the `.before` snapshot; it exports `type Before`. */
  beforeImport?: string;
  title?: string;
  ops: readonly MigrationOpSource[];
};

function target(op: OpTarget): string {
  return `{ block: ${quoteString(op.block)}, field: ${quoteString(op.field)}`;
}

/**
 * The DSL imports an op renders to. `fillField` renders to `addField` and
 * `alterField`, not one `alterBlock`, so both name the field and `migrations
 * apply` can skip them once a later schema change renames or removes it.
 */
function importsOf(op: MigrationOpSource): string[] {
  return op.kind === "fillField" ? ["addField", "alterField"] : [op.kind];
}

function throwPlaceholder(op: OpTarget, depth: number): string {
  const message = `Replace this placeholder for ${op.block}.${op.field} before applying the migration.`;
  return `{\n${INDENT.repeat(depth + 1)}throw new Error(${quoteString(message)});\n${INDENT.repeat(depth)}}`;
}

function renderOp(op: MigrationOpSource, depth: number): string {
  switch (op.kind) {
    case "renameField":
      return `renameField(${target(op)}, to: ${quoteString(op.to)} })`;
    case "removeField":
      return `removeField(${target(op)} })`;
    case "coerceField": {
      const from = op.from ? `, from: ${quoteString(op.from)}` : "";
      return `coerceField(${target(op)}${from}, to: ${quoteString(op.to)} })`;
    }
    case "alterField":
      return `alterField(${target(op)} }, () => ${throwPlaceholder(op, depth)})`;
    case "addField": {
      if (op.value === undefined) {
        return `addField(${target(op)} }, () => ${throwPlaceholder(op, depth)})`;
      }
      const value = formatValue(op.value, depth);
      // An object literal after `=>` would parse as a block body.
      const body = isRecord(op.value) ? `(${value})` : value;
      return `addField(${target(op)} }, () => ${body})`;
    }
    case "fillField": {
      const fill =
        op.value === undefined
          ? throwPlaceholder(op, depth + 1)
          : `{\n${INDENT.repeat(depth + 2)}return ${formatValue(op.value, depth + 2)};\n${INDENT.repeat(depth + 1)}}`;
      const empty = op.fillEmptyString ? "value === null || value === ''" : "value === null";
      const add = renderOp(
        { kind: "addField", block: op.block, field: op.field, value: op.value },
        depth,
      );
      const alter = [
        `alterField(${target(op)} }, (value, { language }) => {`,
        `${INDENT.repeat(depth + 1)}if (language === undefined && (${empty})) ${fill}`,
        `${INDENT.repeat(depth + 1)}return undefined;`,
        `${INDENT.repeat(depth)}})`,
      ].join("\n");
      return `${add},\n${INDENT.repeat(depth)}${alter}`;
    }
    default: {
      const unknown: never = op;
      throw new TypeError(`Unknown migration op kind: ${JSON.stringify(unknown)}`);
    }
  }
}

/**
 * Generates a migration module that default-exports a `defineMigration` call,
 * typed against the project's schema and, when given, its `.before` snapshot.
 */
export function generateMigrationSource(options: GenerateMigrationSourceOptions): string {
  const { schemaImport, beforeImport, title, ops } = options;
  const imports = [...new Set(["defineMigration", ...ops.flatMap(importsOf)])].sort();
  const typeArgs = beforeImport ? "Schema, Before" : "Schema";

  const lines: string[] = [
    `import { ${imports.join(", ")} } from '@storyblok/schema/migrations';`,
    "",
    `import type { Schema } from ${quoteString(schemaImport)};`,
  ];
  if (beforeImport) {
    lines.push(`import type { Before } from ${quoteString(beforeImport)};`);
  }
  lines.push("");

  const opLines: string[] = [];
  const depth = title === undefined ? 1 : 2;
  const opIndent = INDENT.repeat(depth);
  if (ops.length === 0) {
    opLines.push(
      `${opIndent}// Import each op from '@storyblok/schema/migrations', for example:`,
      `${opIndent}// renameField({ block: '<block>', field: '<field>', to: '<new field>' }),`,
    );
  }
  for (const op of ops) {
    for (const todo of op.todo ?? []) {
      opLines.push(`${opIndent}// ${commentText(todo)}`);
    }
    opLines.push(`${opIndent}${renderOp(op, depth)},`);
  }

  if (title === undefined) {
    lines.push(`export default defineMigration<${typeArgs}>([`, ...opLines, "]);", "");
  } else {
    lines.push(
      `export default defineMigration<${typeArgs}>({`,
      `${INDENT}title: ${quoteString(title)},`,
      `${INDENT}ops: [`,
      ...opLines,
      `${INDENT}],`,
      "});",
      "",
    );
  }

  return lines.join("\n");
}

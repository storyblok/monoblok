import type { CoercionTarget } from "../migrations/ops";
import { isRecord } from "../utils/is-record";
import { commentText, formatValue, INDENT, isIdentifier, quoteString } from "./format";

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
  /** Fills an absent or `null` field with `value`. */
  | (OpTarget & { kind: "fillField"; value?: unknown })
);

/** The schema the migration writes: a frozen `.after` snapshot, or the project's live schema. */
type AfterSource =
  | { afterImport: string; schemaImport?: never }
  | { schemaImport: string; afterImport?: never };

export type GenerateMigrationSourceOptions = AfterSource & {
  /** Module specifier of the `.before` snapshot; it exports `type Before`. */
  beforeImport?: string;
  title?: string;
  ops: readonly MigrationOpSource[];
};

function target(op: OpTarget): string {
  return `{ block: ${quoteString(op.block)}, field: ${quoteString(op.field)}`;
}

/** The DSL import an op renders to. `fillField` is sugar over `alterBlock`. */
function importOf(op: MigrationOpSource): string {
  return op.kind === "fillField" ? "alterBlock" : op.kind;
}

function accessor(field: string): string {
  return isIdentifier(field) ? `block.${field}` : `block[${quoteString(field)}]`;
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
      const field = accessor(op.field);
      const inner = INDENT.repeat(depth + 1);
      const body =
        op.value === undefined
          ? `if (${field} === undefined || ${field} === null) ${throwPlaceholder(op, depth + 1)}`
          : `${field} ??= ${formatValue(op.value, depth + 1)};`;
      return `alterBlock({ block: ${quoteString(op.block)} }, (block) => {\n${inner}${body}\n${INDENT.repeat(depth)}})`;
    }
    default: {
      const unknown: never = op;
      throw new TypeError(`Unknown migration op kind: ${JSON.stringify(unknown)}`);
    }
  }
}

/**
 * Generates a migration module that default-exports a `defineMigration` call,
 * typed against the schema it writes and, when given, its `.before` snapshot.
 */
export function generateMigrationSource(options: GenerateMigrationSourceOptions): string {
  const { beforeImport, title, ops } = options;
  const imports = [...new Set(["defineMigration", ...ops.map(importOf)])].sort();
  const after =
    options.afterImport !== undefined
      ? { type: "After", from: options.afterImport }
      : { type: "Schema", from: options.schemaImport };
  const typeArgs = beforeImport ? `${after.type}, Before` : after.type;

  const lines: string[] = [
    `import { ${imports.join(", ")} } from '@storyblok/schema/migrations';`,
    "",
  ];
  if (beforeImport) {
    lines.push(`import type { Before } from ${quoteString(beforeImport)};`);
  }
  lines.push(`import type { ${after.type} } from ${quoteString(after.from)};`, "");

  const opLines: string[] = [];
  const depth = title === undefined ? 1 : 2;
  const opIndent = INDENT.repeat(depth);
  if (ops.length === 0) {
    opLines.push(
      `${opIndent}// Import each op from '@storyblok/schema/migrations', for example:`,
      `${opIndent}// renameField({ block: 'article', field: 'author', to: 'byline' }),`,
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

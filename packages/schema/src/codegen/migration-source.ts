import type { CoercionTarget } from "../migrations/ops";
import { isRecord } from "../utils/is-record";
import { commentText, formatValue, INDENT, quoteString } from "./format";

type OpTarget = { block: string; field: string };

/**
 * A migration op described as data, rendered to the matching call from
 * `@storyblok/schema/migrations`. Callback-taking ops get a placeholder body
 * for the author to fill in; `todo` lines are emitted as comments above it.
 */
export type MigrationOpSource = { todo?: readonly string[] } & (
  | (OpTarget & { kind: "renameField"; to: string })
  | (OpTarget & { kind: "removeField" })
  | (OpTarget & { kind: "coerceField"; from?: CoercionTarget; to: CoercionTarget })
  /** Emits an identity callback. */
  | (OpTarget & { kind: "alterField" })
  /** Backfills absent keys with `value`; without one, the callback returns `undefined`, which skips the block. */
  | (OpTarget & { kind: "addField"; value?: unknown })
  /** Fills an absent or `null` field with `value`; without one, the callback is a no-op. */
  | (OpTarget & { kind: "fillField"; value?: unknown })
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

/** The DSL import an op renders to. `fillField` is sugar over `alterBlock`. */
function importOf(op: MigrationOpSource): string {
  return op.kind === "fillField" ? "alterBlock" : op.kind;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function accessor(field: string): string {
  return IDENTIFIER.test(field) ? `block.${field}` : `block[${quoteString(field)}]`;
}

/** Renders an op at `depth` indentation levels. */
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
      return `alterField(${target(op)} }, (value) => value)`;
    case "addField": {
      const value = formatValue(op.value, depth);
      // An object literal after `=>` would parse as a block body.
      const body = isRecord(op.value) ? `(${value})` : value;
      return `addField(${target(op)} }, () => ${body})`;
    }
    case "fillField": {
      const body =
        op.value === undefined
          ? "{}"
          : `{\n${INDENT.repeat(depth + 1)}${accessor(op.field)} ??= ${formatValue(op.value, depth + 1)};\n${INDENT.repeat(depth)}}`;
      return `alterBlock({ block: ${quoteString(op.block)} }, (block) => ${body})`;
    }
  }
}

/**
 * Generates a migration module that default-exports a `defineMigration` call,
 * typed against the project's schema and, when given, its `.before` snapshot.
 */
export function generateMigrationSource(options: GenerateMigrationSourceOptions): string {
  const { schemaImport, beforeImport, title, ops } = options;
  const imports = [...new Set(["defineMigration", ...ops.map(importOf)])].sort();
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
    opLines.push(`${opIndent}// renameField({ block: 'article', field: 'author', to: 'byline' }),`);
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

import type { CoercionTarget } from "../migrations/ops";
import { isRecord } from "../utils/is-record";
import {
  callDoc,
  group,
  hardline,
  ifBreak,
  indent,
  join,
  line,
  objectDoc,
  PRINT_WIDTH,
  printDoc,
  softline,
  wrapWords,
} from "./doc";
import type { Doc } from "./doc";
import { commentText, INDENT, quoteString } from "./format";

type OpTarget = { block: string; field: string };

/**
 * A migration op described as data, rendered to the matching call from
 * `@storyblok/schema`. `todo` lines are emitted as comments above
 * the call. An op whose callback the generator cannot write gets one that
 * throws, so `migrations run` refuses the op until the author replaces it.
 */
export type MigrationOpSource = { todo?: readonly string[] } & (
  | (OpTarget & { kind: "renameField"; to: string })
  | (OpTarget & { kind: "removeField" })
  | (OpTarget & { kind: "coerceField"; from?: CoercionTarget; to: CoercionTarget })
  /**
   * With `removedValues`, the callback leaves every other value alone and the
   * placeholder only throws on those, as stored by an option field, or held
   * among the values of an options field when `multiple` is set.
   */
  | (OpTarget & { kind: "alterField"; removedValues?: readonly string[]; multiple?: boolean })
  /** Backfills absent keys with `value`. */
  | (OpTarget & { kind: "addField"; value?: unknown })
  /**
   * Fills an absent or `null` field, and `""` with `fillEmptyString`, with
   * `value`. Translations are left as they are.
   */
  | (OpTarget & { kind: "fillField"; value?: unknown; fillEmptyString?: boolean })
  | { kind: "renameBlock"; block: string; to: string }
);

export type GenerateMigrationSourceOptions = {
  /** Module specifier of the schema entry; it must export `type Schema`. */
  schemaImport: string;
  /** Module specifier of the `.before` snapshot; it exports `type Before`. */
  beforeImport?: string;
  title?: string;
  ops: readonly MigrationOpSource[];
};

function valueDoc(value: unknown): Doc {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return group([
      "[",
      indent([softline, join([",", line], value.map(valueDoc))]),
      ifBreak(","),
      softline,
      "]",
    ]);
  }
  if (isRecord(value)) {
    return objectDoc(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined && entry !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, valueDoc(entry)]),
    );
  }
  return typeof value === "string" ? quoteString(value) : String(value);
}

function blockDoc(statements: readonly Doc[]): Doc {
  return group(["{", indent([hardline, join(hardline, statements)]), hardline, "}"]);
}

function arrowDoc(params: string, body: Doc): Doc {
  return [params, " => ", body];
}

function targetDoc(op: OpTarget, ...more: [key: string, value: Doc][]): Doc {
  return objectDoc([["block", quoteString(op.block)], ["field", quoteString(op.field)], ...more]);
}

/** An `if` whose condition breaks at each `||` or `&&` when it doesn't fit. */
function ifDoc(conditions: readonly Doc[], operator: "||" | "&&", then: Doc): Doc {
  return [
    group(["if (", indent([softline, join([` ${operator}`, line], conditions)]), softline, ") "]),
    then,
  ];
}

/**
 * The DSL imports an op renders to. `fillField` renders to `addField` and
 * `alterField`, not one `alterBlock`, so both name the field and `migrations
 * run` can skip them once a later schema change renames or removes it.
 */
function importsOf(op: MigrationOpSource): string[] {
  return op.kind === "fillField" ? ["addField", "alterField"] : [op.kind];
}

function throwPlaceholder(op: OpTarget): Doc {
  const message = `Replace this placeholder for ${op.block}.${op.field} before applying the migration.`;
  return blockDoc([["throw ", callDoc("new Error", [quoteString(message)]), ";"]]);
}

/** A callback that returns `value`, or a placeholder that throws without one. */
function returning(op: OpTarget, value: unknown): Doc {
  if (value === undefined) return throwPlaceholder(op);
  // An object literal after `=>` would parse as a block body.
  return isRecord(value) ? ["(", valueDoc(value), ")"] : valueDoc(value);
}

/** The calls an op renders to; `fillField` renders to two. */
function opDocs(op: MigrationOpSource): Doc[] {
  switch (op.kind) {
    case "renameField":
      return [callDoc("renameField", [targetDoc(op, ["to", quoteString(op.to)])], true)];
    case "removeField":
      return [callDoc("removeField", [targetDoc(op)], true)];
    case "renameBlock":
      return [
        callDoc(
          "renameBlock",
          [
            objectDoc([
              ["block", quoteString(op.block)],
              ["to", quoteString(op.to)],
            ]),
          ],
          true,
        ),
      ];
    case "coerceField": {
      const from: [string, Doc][] = op.from ? [["from", quoteString(op.from)]] : [];
      return [callDoc("coerceField", [targetDoc(op, ...from, ["to", quoteString(op.to)])], true)];
    }
    case "alterField": {
      if (!op.removedValues?.length) {
        return [callDoc("alterField", [targetDoc(op), arrowDoc("()", throwPlaceholder(op))], true)];
      }
      const isRemoved = (value: string) =>
        op.removedValues!.map((removed) => `${value} === ${quoteString(removed)}`);
      const someRemoved = callDoc("value.some", [
        ["(item) =>", group(indent([line, group(join([" ||", line], isRemoved("item")))]))],
      ]);
      const guard = op.multiple
        ? ifDoc(["Array.isArray(value)", someRemoved], "&&", throwPlaceholder(op))
        : ifDoc(isRemoved("value"), "||", throwPlaceholder(op));
      return [
        callDoc(
          "alterField",
          [targetDoc(op), arrowDoc("(value)", blockDoc([guard, "return undefined;"]))],
          true,
        ),
      ];
    }
    case "addField": {
      const callback = arrowDoc("()", returning(op, op.value));
      // Only a callback with a block or object body keeps the call's opening line when it breaks.
      const hugs = op.value === undefined || isRecord(op.value) || Array.isArray(op.value);
      return [callDoc("addField", [targetDoc(op), callback], hugs)];
    }
    case "fillField": {
      const fill =
        op.value === undefined
          ? throwPlaceholder(op)
          : blockDoc([["return ", valueDoc(op.value), ";"]]);
      const missing = op.fillEmptyString
        ? ["language === undefined", "(value === null || value === '')"]
        : ["language === undefined", "value === null"];
      const add = opDocs({ kind: "addField", block: op.block, field: op.field, value: op.value });
      const alter = callDoc(
        "alterField",
        [
          targetDoc(op),
          arrowDoc(
            "(value, { language })",
            blockDoc([ifDoc(missing, "&&", fill), "return undefined;"]),
          ),
        ],
        true,
      );
      return [...add, alter];
    }
    default: {
      const unknown: never = op;
      throw new TypeError(`Unknown migration op kind: ${JSON.stringify(unknown)}`);
    }
  }
}

/** Line comments holding `text`, wrapped to fit the print width. */
function commentLines(text: string, depth: number): Doc[] {
  const width = PRINT_WIDTH - depth * INDENT.length - "// ".length;
  return wrapWords(commentText(text), width).map((comment) => `// ${comment}`);
}

function importDoc(names: readonly string[], from: string, typeOnly = false): Doc {
  const keyword = typeOnly ? "import type" : "import";
  // A formatter keeps a single specifier on the line, however long it is.
  if (names.length === 1) return `${keyword} { ${names[0]} } from ${quoteString(from)};`;
  return group([
    `${keyword} {`,
    indent([line, join([",", line], names)]),
    ifBreak(","),
    line,
    `} from ${quoteString(from)};`,
  ]);
}

/**
 * Generates a migration module that default-exports a `defineMigration` call,
 * typed against the project's schema and, when given, its `.before` snapshot.
 */
export function generateMigrationSource(options: GenerateMigrationSourceOptions): string {
  const { schemaImport, beforeImport, title, ops } = options;
  const imports = [...new Set(["defineMigration", ...ops.flatMap(importsOf)])].sort();
  const typeArgs = beforeImport ? "Schema, Before" : "Schema";
  const depth = title === undefined ? 1 : 2;

  const entries: Doc[] =
    ops.length === 0
      ? [
          "// Import each op from '@storyblok/schema', for example:",
          "// renameField({ block: '<block>', field: '<field>', to: '<new field>' }),",
        ]
      : ops.flatMap((op) => [
          ...(op.todo ?? []).flatMap((todo) => commentLines(todo, depth)),
          ...opDocs(op).map((call) => [call, ","]),
        ]);
  const list = ["[", indent([hardline, join(hardline, entries)]), hardline, "]"];
  const argument =
    title === undefined
      ? list
      : [
          "{",
          indent([
            hardline,
            group(["title:", indent([line, quoteString(title)])]),
            ",",
            hardline,
            "ops: ",
            list,
            ",",
          ]),
          hardline,
          "}",
        ];

  const statements: Doc[] = [
    importDoc(imports, "@storyblok/schema"),
    "",
    importDoc(["Schema"], schemaImport, true),
    ...(beforeImport ? [importDoc(["Before"], beforeImport, true)] : []),
    "",
    [`export default defineMigration<${typeArgs}>(`, argument, ");"],
    "",
  ];
  return printDoc(join(hardline, statements));
}

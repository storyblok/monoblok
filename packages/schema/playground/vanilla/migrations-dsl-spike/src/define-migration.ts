/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * `defineMigration<Schema>({ up })` under test. The builder records declarative
 * operations; the runner (see `runner.ts`) walks a story's content, applies
 * them per block instance, and diffs each touched instance to produce a patch
 * and its inverse.
 */
import type { BlockNameOf, ContentOf, FieldPathOf, SchemaShape, ValueOfPath } from "./types";

export type MigrationOp =
  | { type: "rename"; block: string; from: string; to: string }
  | { type: "remove"; block: string; field: string }
  | { type: "coerce"; block: string; field: string; to: "string" | "number" | "boolean" }
  | { type: "move"; block: string; from: string; to: string }
  | { type: "setValue"; block: string; field: string; value: unknown }
  | { type: "alter"; block: string; fn: (block: any) => any };

export interface FieldHandle<TSchema extends SchemaShape, TPath extends FieldPathOf<TSchema>> {
  /** New name is free text: the target name is by definition not in the current schema. */
  renameTo: (name: string) => void;
  remove: () => void;
  asString: () => void;
  asNumber: () => void;
  asBoolean: () => void;
  /** Move this field's value onto another field of the same block. */
  moveTo: (name: string) => void;
  set: (value: ValueOfPath<TSchema, TPath>) => void;
}

export interface BlockHandle<TSchema extends SchemaShape, TName extends BlockNameOf<TSchema>> {
  alter: (fn: (block: ContentOf<TSchema, TName>) => void | ContentOf<TSchema, TName>) => void;
}

export interface MigrationBuilder<TSchema extends SchemaShape> {
  field: <TPath extends FieldPathOf<TSchema>>(path: TPath) => FieldHandle<TSchema, TPath>;
  block: <TName extends BlockNameOf<TSchema>>(name: TName) => BlockHandle<TSchema, TName>;
}

export interface MigrationDefinition<TSchema extends SchemaShape> {
  name?: string;
  up: (m: MigrationBuilder<TSchema>) => void;
}

export interface CompiledMigration {
  name?: string;
  ops: MigrationOp[];
  /** Block names any op targets — used to skip stories that contain none of them. */
  targets: string[];
}

export function defineMigration<TSchema extends SchemaShape>(
  definition: MigrationDefinition<TSchema>,
): CompiledMigration {
  const ops: MigrationOp[] = [];

  const builder = {
    field(path: string) {
      const dot = path.indexOf(".");
      const block = path.slice(0, dot);
      const field = path.slice(dot + 1);
      return {
        renameTo: (name: string) => void ops.push({ type: "rename", block, from: field, to: name }),
        remove: () => void ops.push({ type: "remove", block, field }),
        asString: () => void ops.push({ type: "coerce", block, field, to: "string" }),
        asNumber: () => void ops.push({ type: "coerce", block, field, to: "number" }),
        asBoolean: () => void ops.push({ type: "coerce", block, field, to: "boolean" }),
        moveTo: (name: string) => void ops.push({ type: "move", block, from: field, to: name }),
        set: (value: unknown) => void ops.push({ type: "setValue", block, field, value }),
      };
    },
    block(name: string) {
      return {
        alter: (fn: (block: any) => any) => void ops.push({ type: "alter", block: name, fn }),
      };
    },
  } as unknown as MigrationBuilder<TSchema>;

  definition.up(builder);

  return {
    name: definition.name,
    ops,
    targets: [...new Set(ops.map((op) => op.block))],
  };
}

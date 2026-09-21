/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * Runtime counterpart to the compile-time path union: rejects a migration whose
 * ops address a block or field the local schema does not define. Needed because
 * a migration can also be loaded from a plain `.js` file, where the type union
 * buys nothing.
 */
import type { SchemaLike } from "@storyblok/schema";
import type { CompiledMigration } from "./define-migration";

export interface MigrationIssue {
  op: number;
  message: string;
}

function blockNames(schema: SchemaLike): Map<string, Set<string>> {
  const blocks = Array.isArray(schema.blocks) ? schema.blocks : Object.values(schema.blocks ?? {});
  const map = new Map<string, Set<string>>();
  for (const block of blocks as { name: string; fields?: { name: string }[] }[]) {
    map.set(block.name, new Set((block.fields ?? []).map((field) => field.name)));
  }
  return map;
}

export function validateMigration(
  migration: CompiledMigration,
  schema: SchemaLike,
): MigrationIssue[] {
  const known = blockNames(schema);
  const issues: MigrationIssue[] = [];

  migration.ops.forEach((op, index) => {
    const fields = known.get(op.block);
    if (!fields) {
      issues.push({
        op: index,
        message: `Unknown block "${op.block}". Known blocks: ${[...known.keys()].sort().join(", ")}.`,
      });
      return;
    }
    const sourceField =
      op.type === "rename" || op.type === "move"
        ? op.from
        : op.type === "remove" || op.type === "coerce" || op.type === "setValue"
          ? op.field
          : undefined;
    if (sourceField !== undefined && !fields.has(sourceField)) {
      issues.push({
        op: index,
        message: `Block "${op.block}" has no field "${sourceField}". Known fields: ${[...fields].sort().join(", ")}.`,
      });
    }
    if ((op.type === "rename" || op.type === "move") && fields.has(op.to) && op.type === "rename") {
      issues.push({
        op: index,
        message: `Block "${op.block}" already defines a field "${op.to}"; renaming "${op.from}" onto it would overwrite content.`,
      });
    }
  });

  return issues;
}

/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * Runtime counterpart to the compile-time name unions: rejects a migration whose
 * ops address a block or field the local schema does not define. Needed because
 * a migration can also be loaded from a plain `.js` file, and because the
 * one-schema shorthand deliberately widens reads to any string.
 */
import type { SchemaLike } from "@storyblok/schema";
import type { CompiledMigration } from "./define-migration";
import { isKeyOp, type MigrationOp } from "./ops";

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

/** The field an op reads, or `undefined` for one that names no field. */
function sourceFieldOf(op: MigrationOp): string | undefined {
  return op.kind === "alterBlock" ? undefined : op.field;
}

export function validateMigration(
  migration: CompiledMigration,
  schema: SchemaLike,
): MigrationIssue[] {
  const known = blockNames(schema);
  const issues: MigrationIssue[] = [];

  migration.ops.forEach((op, index) => {
    const under = "under" in op ? op.under : undefined;
    if (under !== undefined) {
      // A key op moves the component schema, which is global; scoping one to a
      // subset would leave every other instance holding a key no schema
      // describes. The type system rejects this as an excess property, so this
      // is the check for a migration that never went through the type system.
      if (isKeyOp(op)) {
        issues.push({
          op: index,
          message: `"${op.kind}" cannot be scoped with \`under\`: a component's schema is global, so a key op has to apply to every instance.`,
        });
      }
      for (const name of typeof under === "string" ? [under] : under) {
        if (!known.has(name)) {
          issues.push({ op: index, message: `Unknown ancestor block "${name}" in \`under\`.` });
        }
      }
    }

    const fields = known.get(op.block);
    if (!fields) {
      issues.push({
        op: index,
        message: `Unknown block "${op.block}". Known blocks: ${[...known.keys()].sort().join(", ")}.`,
      });
      return;
    }

    const sourceField = sourceFieldOf(op);
    if (sourceField !== undefined && !fields.has(sourceField)) {
      issues.push({
        op: index,
        message: `Block "${op.block}" has no field "${sourceField}". Known fields: ${[...fields].sort().join(", ")}.`,
      });
    }
    if (op.kind === "renameField" && fields.has(op.to)) {
      issues.push({
        op: index,
        message: `Block "${op.block}" already defines a field "${op.to}"; renaming "${op.field}" onto it would overwrite content.`,
      });
    }
  });

  return issues;
}

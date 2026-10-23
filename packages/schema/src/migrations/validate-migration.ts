/**
 * Runtime counterpart to the compile-time name unions: rejects a migration whose
 * ops address a block or field the schema does not define. Needed because a
 * migration can also be loaded from a plain `.js` file, and because the
 * one-schema shorthand deliberately widens reads to any string.
 */
import type { SchemaLike } from "../index";
import { toValues } from "../validators/shapes";
import type { CompiledMigration } from "./define-migration";
import { isKeyOp, type MigrationOp } from "./ops";

export interface MigrationIssue {
  op: number;
  /** An error is a mismatch; a warning is a check the schema holds too little to make. */
  severity: "error" | "warning";
  message: string;
}

export type ValidateMigrationOptions = {
  /**
   * Blocks that exist but whose fields the schema does not describe, such as
   * the name-only blocks of a schema snapshot. An op reading their fields is an
   * error; a container check that needs their fields is a warning.
   */
  nameOnlyBlocks?: Iterable<string>;
};

function fieldsByBlock(schema: SchemaLike): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const block of toValues(schema.blocks)) {
    map.set(block.name, new Set((block.fields ?? []).map((field) => field.name)));
  }
  return map;
}

/** The fields an op reads, which must exist by the time it runs. */
function sourceFieldsOf(op: MigrationOp): readonly string[] {
  switch (op.kind) {
    case "alterBlock":
    case "expandBlock":
    case "renameBlock":
    case "addField":
      return [];
    case "mergeFields":
      return op.fields;
    default:
      return [op.field];
  }
}

/** How an op changes the fields of the block it addresses. */
function applyToFields(op: MigrationOp, fields: Set<string>): void {
  switch (op.kind) {
    case "renameField":
    case "moveField":
      fields.delete(op.field);
      fields.add(op.to);
      break;
    case "removeField":
      fields.delete(op.field);
      break;
    case "addField":
      fields.add(op.field);
      break;
    case "splitField":
      fields.delete(op.field);
      for (const field of op.into) fields.add(field);
      break;
    case "mergeFields":
      for (const field of op.fields) fields.delete(field);
      fields.add(op.into);
      break;
    default:
      break;
  }
}

function listOf(names: Iterable<string>): string {
  return [...names].sort().join(", ") || "none";
}

/**
 * Checks a migration against `schema`, the schema the content has before the
 * migration runs. Ops run in order, so a field an earlier op added or renamed
 * is a valid source for a later one. Every op addresses a block by its
 * pre-migration name, which a `renameBlock` does not change.
 */
export function validateMigration(
  migration: CompiledMigration,
  schema: SchemaLike,
  options: ValidateMigrationOptions = {},
): MigrationIssue[] {
  const nameOnly = new Set(options.nameOnlyBlocks);
  const known = fieldsByBlock(schema);
  for (const name of nameOnly) known.delete(name);
  const fields = new Map([...known].map(([name, set]) => [name, new Set(set)]));
  const exists = (name: string) => known.has(name) || nameOnly.has(name);
  const knownNames = () => listOf(new Set([...known.keys(), ...nameOnly]));
  const issues: MigrationIssue[] = [];

  migration.ops.forEach((op, index) => {
    const issue = (message: string) => issues.push({ op: index, severity: "error", message });
    const warning = (message: string) => issues.push({ op: index, severity: "warning", message });

    const under = "under" in op ? op.under : undefined;
    if (under !== undefined) {
      // A key op changes the block schema, which is global; scoping one to a
      // subset would leave every other instance holding a key no schema
      // describes. The type system rejects this as an excess property, so this
      // is the check for a migration that never went through the type system.
      if (isKeyOp(op)) {
        issue(
          `"${op.kind}" cannot be scoped with \`under\`: a block's schema is global, so a key op has to apply to every instance.`,
        );
      }
      // The op type promises names, but a migration that skipped the type
      // system can carry anything here.
      const ancestors: readonly unknown[] | undefined =
        typeof under === "string" ? [under] : Array.isArray(under) ? under : undefined;
      if (ancestors === undefined || !ancestors.every((name) => typeof name === "string")) {
        issue("`under` has to be a block name or a list of block names.");
      } else {
        for (const name of ancestors) {
          if (!exists(name)) issue(`Unknown ancestor block "${name}" in \`under\`.`);
        }
      }
    }

    const blockFields = fields.get(op.block);
    if (nameOnly.has(op.block)) {
      if (sourceFieldsOf(op).length > 0) {
        issue(
          `Block "${op.block}" is listed by name only, so the fields this op reads can't be checked. Check the migration against a schema that defines the fields of "${op.block}".`,
        );
      }
    } else if (!blockFields) {
      issue(`Unknown block "${op.block}". Known blocks: ${knownNames()}.`);
      return;
    } else {
      for (const field of sourceFieldsOf(op)) {
        if (!blockFields.has(field)) {
          issue(
            `Block "${op.block}" has no field "${field}". Known fields: ${listOf(blockFields)}.`,
          );
        }
      }
      if (op.kind === "renameField" && blockFields.has(op.to)) {
        issue(
          `Block "${op.block}" already defines a field "${op.to}"; renaming "${op.field}" onto it would overwrite content.`,
        );
      }
    }
    if (op.kind === "renameBlock" && exists(op.to)) {
      issue(
        `Block "${op.to}" already exists; renaming "${op.block}" onto it would merge two blocks' content under one name, which cannot be undone.`,
      );
    }
    if (op.kind === "wrapChildren") {
      // An unknown container is a block the migration introduces.
      const container = fields.get(op.in);
      if (nameOnly.has(op.in)) {
        warning(
          `Block "${op.in}" already exists but is listed by name only, so whether it defines the field "${op.into}" can't be checked.`,
        );
      } else if (container && !container.has(op.into)) {
        issue(
          `Block "${op.in}" already exists and has no field "${op.into}"; wrapping into it would leave the children under a field its schema does not define.`,
        );
      }
    }
    if (op.kind === "unwrapChildren") {
      const container = known.get(op.unwrap);
      if (nameOnly.has(op.unwrap)) {
        warning(
          `Block "${op.unwrap}" is listed by name only, so whether it defines the field "${op.from}" can't be checked.`,
        );
      } else if (!container) {
        issue(`Unknown block "${op.unwrap}" to unwrap. Known blocks: ${knownNames()}.`);
      } else if (!container.has(op.from)) {
        issue(`Block "${op.unwrap}" has no field "${op.from}" to unwrap children from.`);
      }
    }

    if (blockFields) applyToFields(op, blockFields);
  });

  return issues;
}

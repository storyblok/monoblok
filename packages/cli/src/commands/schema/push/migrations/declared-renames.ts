import { CommandError } from "../../../../utils";
import type { RemoteSchemaData, SchemaData } from "../../types";
import type { BlockRename } from "../block-renames";
import type { BreakingChange, ComponentBreakingChanges } from "./types";

export type DeclaredRename = { block: string; field: string; to: string };

/** Splits `a:b` into its two names, or `undefined` when either is missing. */
export function pairOf(value: string): [string, string] | undefined {
  const [from, to, ...rest] = value.split(":");
  return from && to && rest.length === 0 ? [from, to] : undefined;
}

const describe = ({ block, field, to }: DeclaredRename) => `${block}.${field}:${to}`;

/** Parses `--rename` values, refusing two that rename one field or onto one field. */
export function parseDeclaredRenames(values: readonly string[]): Map<string, DeclaredRename> {
  const declared = new Map<string, DeclaredRename>();
  for (const value of values) {
    const pair = pairOf(value);
    const dot = pair?.[0].indexOf(".") ?? -1;
    if (!pair || dot <= 0) {
      throw new CommandError(`Invalid --rename "${value}". Use --rename block.field:new-field.`);
    }
    const rename = { block: pair[0].slice(0, dot), field: pair[0].slice(dot + 1), to: pair[1] };
    for (const other of declared.values()) {
      if (other.block !== rename.block) continue;
      if (other.field === rename.field) {
        throw new CommandError(
          `--rename ${describe(other)} and --rename ${describe(rename)} both rename ${rename.block}.${rename.field}.`,
        );
      }
      if (other.to === rename.to) {
        throw new CommandError(
          `--rename ${describe(other)} and --rename ${describe(rename)} both rename a field to ${rename.block}.${rename.to}.`,
        );
      }
    }
    declared.set(pair[0], rename);
  }
  return declared;
}

/**
 * Refuses a declared field rename unless the push removes its field from the
 * block and adds its new field. `remote` names renamed blocks by their new
 * name, and so does `--rename`.
 */
export function checkDeclaredRenames(
  declared: ReadonlyMap<string, DeclaredRename>,
  local: SchemaData,
  remote: RemoteSchemaData,
  blockRenames: readonly BlockRename[],
): void {
  for (const rename of declared.values()) {
    const { block, field, to } = rename;
    const localBlock = local.components.find((component) => component.name === block);
    if (!localBlock) {
      const blockRename = blockRenames.find(({ from }) => from === block);
      throw new CommandError(
        blockRename
          ? `--rename ${describe(rename)}: this push renames ${block} to ${blockRename.to}, so name the block by its new name: --rename ${blockRename.to}.${field}:${to}.`
          : `--rename ${describe(rename)}: the schema has no block ${block}.`,
      );
    }
    const localFields = localBlock.schema ?? {};
    const remoteFields = remote.components.get(block)?.schema ?? {};
    if (!(field in remoteFields) || field in localFields) {
      throw new CommandError(
        `--rename ${describe(rename)} doesn't match a field this push removes from ${block}.`,
      );
    }
    if (to in remoteFields) {
      throw new CommandError(
        `--rename ${describe(rename)}: ${block} already has a field ${to}, so the push doesn't add it.`,
      );
    }
    if (!(to in localFields)) {
      throw new CommandError(
        `--rename ${describe(rename)}: the schema has no field ${to} in ${block}.`,
      );
    }
  }
}

/**
 * Replaces whatever detection made of a renamed field, a removal, a split or
 * a rename onto another field, with the rename `--rename` declared. A rename
 * onto a new required field also drops the backfill of that field, since the
 * rename fills it.
 */
export function applyDeclaredRenames(
  changes: ComponentBreakingChanges[],
  declared: ReadonlyMap<string, DeclaredRename>,
): void {
  for (const { block, field, to } of declared.values()) {
    const comp = changes.find((candidate) => candidate.componentName === block);
    const consumes = (change: BreakingChange): boolean =>
      (change.kind === "rename" && (change.oldField === field || change.field === to)) ||
      ((change.kind === "removed" || change.kind === "split") && change.field === field) ||
      (change.kind === "required_added" && change.field === to);
    if (!comp?.changes.some((change) => change.kind !== "required_added" && consumes(change))) {
      throw new CommandError(
        `--rename ${describe({ block, field, to })} doesn't match a field this push removes from ${block}.`,
      );
    }
    const firstIndex = comp.changes.findIndex(consumes);
    // A detected rename of another field onto `to` leaves that field removed.
    const orphaned: BreakingChange[] = comp.changes.flatMap((change): BreakingChange[] =>
      change.kind === "rename" && change.field === to && change.oldField !== field
        ? [{ kind: "removed", field: change.oldField }]
        : [],
    );
    const rest = comp.changes.filter((change) => !consumes(change));
    rest.splice(firstIndex, 0, { kind: "rename", field: to, oldField: field }, ...orphaned);
    comp.changes = rest;
  }
}

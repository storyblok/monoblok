import { CommandError } from "../../../../utils";
import type { BreakingChange, ComponentBreakingChanges } from "./types";

export type DeclaredRename = { block: string; field: string; to: string };

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
        `--rename ${block}.${field}:${to} doesn't match a field this push removes from ${block}.`,
      );
    }
    const firstIndex = comp.changes.findIndex(consumes);
    const rest = comp.changes.filter((change) => !consumes(change));
    rest.splice(firstIndex, 0, { kind: "rename", field: to, oldField: field });
    comp.changes = rest;
  }
}

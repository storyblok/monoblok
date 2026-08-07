/** A single breaking change detected in a component schema. */
export type BreakingChange =
  | { kind: 'rename'; field: string; oldField: string }
  | { kind: 'removed'; field: string; renameHint?: { newField: string } }
  | { kind: 'type_changed'; field: string; oldType: string; newType: string }
  | { kind: 'required_added'; field: string; fieldType: string }
  | { kind: 'required_changed'; field: string; fieldType: string };

/** All breaking changes for a single component. */
export interface ComponentBreakingChanges {
  componentName: string;
  changes: BreakingChange[];
}

/** A heuristic rename match: one removed field paired with one added field. */
export interface RenameMatch {
  oldField: string;
  newField: string;
  fieldType: string;
}

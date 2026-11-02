/** A single breaking change detected in a component schema. */
export type BreakingChange =
  | { kind: "rename"; field: string; oldField: string }
  | { kind: "removed"; field: string; renameHint?: { newFields: string[] } }
  /** A removed field whose content most likely moved into several new fields. */
  | { kind: "split"; field: string; into: string[] }
  | { kind: "type_changed"; field: string; oldType: string; newType: string }
  | { kind: "required_added"; field: string; fieldType: string }
  | { kind: "required_changed"; field: string; fieldType: string }
  /** Values an option or options field no longer offers, which stories may still hold. */
  | { kind: "options_removed"; field: string; values: string[]; multiple: boolean }
  /** The block itself was renamed in place; the change list addresses it by its new name. */
  | { kind: "block_renamed"; from: string; to: string };

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

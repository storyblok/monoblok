/**
 * Content migrations: apply a typed list of ops to a space's story content and
 * record enough to undo it.
 */
export { defineMigration } from "./define-migration";
export type { CompiledMigration, MigrationDefinition, MigrationOps } from "./define-migration";

export {
  addField,
  alterBlock,
  alterField,
  coerceField,
  expandBlock,
  mergeFields,
  moveField,
  removeField,
  renameBlock,
  renameField,
  reorderField,
  splitField,
  unwrapChildren,
  wrapChildren,
} from "./ops";
export type {
  AddFieldOp,
  AlterFieldContext,
  AnyChild,
  CoercionTarget,
  ExpandBlockOp,
  MergeFieldsOp,
  MigrationOp,
  MigrationOpOf,
  RenameBlockOp,
  ReorderContext,
  SplitFieldOp,
  UnderOf,
  UnwrapChildrenOp,
  WrapChildrenOp,
} from "./ops";

export type { AnyBlock, BlockPatch, BlockPatchOp } from "./patch";

export { deriveInverse } from "./derive-inverse";
export type { DerivedInverse, UnderivableOp } from "./derive-inverse";

export { validateMigration } from "./validate-migration";
export type { MigrationIssue } from "./validate-migration";

export { runId } from "./journal";
export type { Journal, MigrationRun, PublishState, StoryInverse } from "./journal";

export { applyMigration } from "./apply-migration";
export type {
  ApplyMigrationInput,
  ApplyMigrationOutcome,
  MigrationWrite,
  PublishMode,
  StoryForMigration,
} from "./apply-migration";

export { MigrationError } from "./migration-error";
export { planUndo, undoStories } from "./undo-run";
export type { UndoOutcome, UndoPlan, UndoStoriesInput, UndoWrite } from "./undo-run";

export { checkPendingReleases } from "./releases";
export type { PendingReleasesCheck, ReleaseForMigration } from "./releases";

export { discoverMigrations, loadMigrations, selectMigrationFiles } from "./load-migrations";
export type { ImportDefault, LoadedMigration, MigrationFile } from "./load-migrations";

export { JOURNAL_DIRECTORY, localJournal, resolveJournal } from "./local-journal";

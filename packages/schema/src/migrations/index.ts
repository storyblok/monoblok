/**
 * Content migrations: apply a typed list of ops to a space's story content and
 * record enough to undo it. Free of I/O: functions return what to write, and
 * the caller performs the Management API calls. Filesystem helpers live in
 * `@storyblok/schema/migrations/node`.
 */
export { defineMigration } from "./define-migration";
export type { CompiledMigration, MigrationDefinition, MigrationOps } from "./define-migration";

export {
  addField,
  alterBlock,
  alterField,
  coerceField,
  expandBlock,
  isKeyOp,
  KEY_OP_KINDS,
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

export { applyPatches, diffBlock, indexBlocks, TRANSLATION_SEPARATOR } from "./patch";
export type { AnyBlock, ApplyConflict, ApplyResult, BlockPatch, BlockPatchOp } from "./patch";

export { blockComponents, runMigrationOnStory } from "./runner";
export type { StoryMigrationResult } from "./runner";

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

export { MigrationError, planUndo, undoStories } from "./undo-run";
export type { UndoOutcome, UndoPlan, UndoStoriesInput, UndoWrite } from "./undo-run";

export { checkPendingReleases } from "./releases";
export type { PendingReleasesCheck, ReleaseForMigration } from "./releases";

/**
 * Content migrations: apply a typed list of ops to a space's story content and
 * record enough to undo it.
 *
 * Not exported from the package root. Whether content migrations belong in
 * `@storyblok/schema` at all is open — see the prototype design doc; the
 * subpath export exists so this can move without breaking a consumer's import.
 */
export { defineMigration } from "./define-migration";
export type { CompiledMigration, MigrationDefinition, MigrationOps } from "./define-migration";

export {
  addField,
  alterBlock,
  alterField,
  coerceField,
  isKeyOp,
  KEY_OP_KINDS,
  moveField,
  removeField,
  renameField,
  reorderField,
} from "./ops";
export type {
  AddFieldOp,
  AlterFieldContext,
  AnyChild,
  CoercionTarget,
  MigrationOp,
  MigrationOpOf,
  UnderOf,
} from "./ops";

export { applyPatches, diffBlock, indexBlocks, TRANSLATION_SEPARATOR } from "./patch";
export type { AnyBlock, ApplyConflict, ApplyResult, BlockPatch, BlockPatchOp } from "./patch";

export { blockComponents, runMigrationOnStory } from "./runner";
export type { StoryMigrationResult } from "./runner";

export { deriveInverse } from "./derive-inverse";
export type { DerivedInverse, UnderivableOp } from "./derive-inverse";

export { validateMigration } from "./validate-migration";
export type { MigrationIssue } from "./validate-migration";

export type { Journal, MigrationRun, StoryInverse } from "./journal";
export { localJournal, runId } from "./journal-local";

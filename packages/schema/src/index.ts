/**
 * Public API surface for `@storyblok/schema`.
 *
 * The package defines the shape of user-generated content: blocks, fields, and
 * datasources, plus the story and block-content types derived from them.
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 */

export type { MapiStory } from "./generated/types/mapi-story";

// Story
export type { Story } from "./generated/types/story";
// Block
export { defineBlock } from "./helpers/define-block";

export type { Block, BlockFields, NestableBlock, RootBlock } from "./helpers/define-block";
// Conditional settings
export { hideWhen, requiredWhen } from "./helpers/define-condition";
export type { ConditionOptions, FieldCondition } from "./helpers/define-condition";
// Datasource
export { defineDatasource } from "./helpers/define-datasource";
export type { Datasource } from "./helpers/define-datasource";
// Field
export { defineField } from "./helpers/define-field";
export type {
  AssetFieldValue,
  BlockContent,
  BlockContentInput,
  BlocksFieldValue,
  CheckedField,
  DefinedField,
  Field,
  FieldInput,
  FieldType,
  FieldValue,
  FieldValueInput,
  MultilinkFieldValue,
  PluginFieldValue,
  RichTextFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from "./helpers/define-field";
// Field plugin
export { defineFieldPlugin } from "./helpers/define-field-plugin";

export type { FieldPlugin } from "./helpers/define-field-plugin";

// Folder
export { defineFolder } from "./helpers/define-folder";

export type { BlockFolder } from "./helpers/define-folder";

// Schema
export { defineSchema } from "./helpers/define-schema";
export type { Schema } from "./helpers/schema-type";

// Field types
export { FIELD_TYPES } from "./field-types";
// Restrictions
export {
  DENIABLE_FIELD_TYPES,
  DERIVED_RESTRICTION_KEYS,
  EDITOR_RESTRICT_TYPES,
  TAG_LIST_KEYS,
} from "./restrictions";
export type { DerivedRestrictionKey } from "./restrictions";
// Validators (Zod-powered, non-throwing)
export { createStoryValidator } from "./validators/create-story-validator";
// Loose structural input shapes accepted by the validators — exported so
// callers loading schemas at runtime (e.g. the CLI) can type their input.
export type {
  SchemaBlockLike,
  SchemaDatasourceLike,
  SchemaFieldLike,
  SchemaLike,
} from "./validators/shapes";
export type { ValidationIssue, ValidationResult, ValidationSeverity } from "./validators/types";
export { validateSchema } from "./validators/validate-schema";
export { validateStory } from "./validators/validate-story";
// Content migrations
export { defineMigration } from "./migrations/define-migration";
export type {
  CompiledMigration,
  MigrationDefinition,
  MigrationOps,
} from "./migrations/define-migration";

export {
  addField,
  alterBlock,
  alterField,
  coerceField,
  expandBlock,
  fieldsToBlock,
  mergeFields,
  moveField,
  removeField,
  renameBlock,
  renameField,
  reorderField,
  splitField,
  unwrapChildren,
  wrapChildren,
} from "./migrations/ops";
export type {
  AddFieldOp,
  AlterFieldContext,
  AnyChild,
  CoercionTarget,
  ExpandBlockOp,
  FieldsToBlockOp,
  MergeFieldsOp,
  MigrationOp,
  MigrationOpOf,
  RenameBlockOp,
  ReorderContext,
  SplitFieldOp,
  UnderOf,
  UnwrapChildrenOp,
  WrapChildrenOp,
} from "./migrations/ops";

export type { AnyBlock, BlockPatch, BlockPatchOp } from "./migrations/patch";

export { deriveInverse } from "./migrations/derive-inverse";
export type { DerivedInverse, UnderivableOp } from "./migrations/derive-inverse";

export { validateMigration } from "./migrations/validate-migration";
export type { MigrationIssue, ValidateMigrationOptions } from "./migrations/validate-migration";

export { runId } from "./migrations/journal";
export type { Journal, MigrationRun, PublishState, StoryInverse } from "./migrations/journal";

export { applyMigration, settleRun } from "./migrations/apply-migration";
export type {
  ApplyMigrationInput,
  ApplyMigrationOutcome,
  LandedWrite,
  MigrationWrite,
  PublishMode,
  StoryForMigration,
} from "./migrations/apply-migration";

export { MigrationError } from "./migrations/migration-error";
export { planUndo, undoStories } from "./migrations/undo-run";
export type {
  ConflictingBlock,
  UndoOutcome,
  UndoPlan,
  UndoStoriesInput,
  UndoWrite,
} from "./migrations/undo-run";

export { checkPendingReleases } from "./migrations/releases";
export type { PendingReleasesCheck, ReleaseForMigration } from "./migrations/releases";

export {
  discoverMigrations,
  loadMigrations,
  selectMigrationFiles,
} from "./migrations/load-migrations";
export type {
  ImportDefault,
  LoadedMigration,
  LoadMigrationsOptions,
  MigrationFile,
} from "./migrations/load-migrations";

export { localJournal } from "./migrations/local-journal";

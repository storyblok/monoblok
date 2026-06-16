/**
 * Public API surface for `@storyblok/schema`.
 *
 * The package defines the shape of user-generated content: blocks, fields, and
 * datasources, plus the story/content types derived from them. Payload builders
 * and wire-only entities live in the typed clients, not here.
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 */

// Story helpers + derived content types
export { createStoryHelpers } from './helpers/create-story-helpers';
// Block
export { defineBlock } from './helpers/define-block';

export type { Block, BlockFields, NestableBlock, RootBlock } from './helpers/define-block';
// Datasource
export { defineDatasource } from './helpers/define-datasource';

export type { Datasource } from './helpers/define-datasource';
// Field
export { defineField } from './helpers/define-field';

export type {
  AssetFieldValue,
  BlockContent,
  BlockContentInput,
  BlocksFieldValue,
  DefinedField,
  Field,
  FieldInput,
  FieldType,
  FieldValue,
  FieldValueInput,
  MultilinkFieldValue,
  PluginFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from './helpers/define-field';
export type { MapiStory, Story } from './helpers/define-story';

// Schema type helper
export type { Schema } from './helpers/schema-type';

// Validators (Zod-powered, non-throwing)
export { createStoryValidator } from './validators/create-story-validator';
export type { ValidationIssue, ValidationResult, ValidationSeverity } from './validators/types';
export { validateSchema } from './validators/validate-schema';
export { validateStory } from './validators/validate-story';

/**
 * Public API surface for `@storyblok/schema/zod`.
 *
 * CDN (CAPI) schemas use the bare name (e.g. `storySchema`).
 * MAPI schemas use the `mapi` prefix where a CDN schema with the same name exists (e.g. `mapiStorySchema`).
 * MAPI-only schemas keep their bare name (e.g. `assetFolderSchema`, `presetSchema`).
 *
 * Every export is listed explicitly — no wildcard (`*`) re-exports.
 */

// MAPI schemas (mapi prefix where CDN collision exists)
export {
  asset as mapiAssetSchema,
  datasource as mapiDatasourceSchema,
  datasourceEntry as mapiDatasourceEntrySchema,
  space as mapiSpaceSchema,
  story as mapiStorySchema,
} from '../generated/mapi-zod-schemas';
// MAPI-only schemas (no CDN counterpart — bare names)
export {
  assetField as assetFieldSchema,
  assetFolder as assetFolderSchema,
  assetUpdate as assetUpdateSchema,
  baseField as baseFieldSchema,
  bloksField as bloksFieldSchema,
  booleanField as booleanFieldSchema,
  bulkMove_Body as bulkMoveBodySchema,
  collaborator as collaboratorSchema,
  componentCreate as componentCreateSchema,
  componentFolder as componentFolderSchema,
  componentSchemaField as componentSchemaFieldSchema,
  componentUpdate as componentUpdateSchema,
  componentVersion as componentVersionSchema,
  create_Body as createBodySchema,
  customField as customFieldSchema,
  datasourceCreate as datasourceCreateSchema,
  datasourceUpdate as datasourceUpdateSchema,
  datetimeField as datetimeFieldSchema,
  deleteMany_Body as deleteManyBodySchema,
  getUnpublishedDependencies_Body as getUnpublishedDependenciesBodySchema,
  importStory_Body as importStoryBodySchema,
  internalTag as internalTagSchema,
  markdownField as markdownFieldSchema,
  multiassetField as multiassetFieldSchema,
  multilinkField as multilinkFieldSchema,
  numberField as numberFieldSchema,
  optionField as optionFieldSchema,
  optionsField as optionsFieldSchema,
  preset as presetSchema,
  restoreVersion_Body as restoreVersionBodySchema,
  richtextField as richtextFieldSchema,
  sectionField as sectionFieldSchema,
  signedResponseObject as signedResponseObjectSchema,
  storyCreate as storyCreateSchema,
  storyCreateRequest as storyCreateRequestSchema,
  storyDuplicateRequest as storyDuplicateRequestSchema,
  storyUpdate as storyUpdateSchema,
  storyUpdateRequest as storyUpdateRequestSchema,
  storyVersion as storyVersionSchema,
  storyVersionComparison as storyVersionComparisonSchema,
  tabField as tabFieldSchema,
  tableField as tableFieldSchema,
  textareaField as textareaFieldSchema,
  textField as textFieldSchema,
  translate_Body as translateBodySchema,
  update_Body as updateBodySchema,
  user as userSchema,
} from '../generated/mapi-zod-schemas';

// CDN schemas (bare names)
export {
  datasource as datasourceSchema,
  datasourceEntry as datasourceEntrySchema,
  link as linkSchema,
  space as spaceSchema,
  story as storySchema,
  tag as tagSchema,
} from '../generated/zod-schemas';

export { componentSchema } from './schemas/component-schema';

export { contentValueSchemas } from './schemas/content-value-schemas';
export { fieldSchema } from './schemas/field-schema';

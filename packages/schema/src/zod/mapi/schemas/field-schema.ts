import { z } from 'zod';
import {
  assetFieldConfig,
  bloksFieldConfig,
  booleanFieldConfig,
  customFieldConfig,
  datetimeFieldConfig,
  markdownFieldConfig,
  multiassetFieldConfig,
  multilinkFieldConfig,
  numberFieldConfig,
  optionFieldConfig,
  optionsFieldConfig,
  richtextFieldConfig,
  sectionFieldConfig,
  tabFieldConfig,
  tableFieldConfig,
  textareaFieldConfig,
  textFieldConfig,
} from '../../../generated/mapi-zod-schemas';

/**
 * Union Zod schema for all field types.
 * Uses z.union (not z.discriminatedUnion) because the generated field config
 * schemas are ZodIntersection types (from baseFieldConfig.and(...)), which are
 * not compatible with z.discriminatedUnion in Zod v3.
 *
 * Each variant uses .passthrough() (inherited from the generated schemas),
 * so unknown keys are accepted.
 */
export const fieldSchema = z.union([
  textFieldConfig,
  textareaFieldConfig,
  richtextFieldConfig,
  markdownFieldConfig,
  numberFieldConfig,
  datetimeFieldConfig,
  booleanFieldConfig,
  optionFieldConfig,
  optionsFieldConfig,
  assetFieldConfig,
  multiassetFieldConfig,
  multilinkFieldConfig,
  bloksFieldConfig,
  tableFieldConfig,
  sectionFieldConfig,
  tabFieldConfig,
  customFieldConfig,
]);

export type FieldSchema = z.infer<typeof fieldSchema>;

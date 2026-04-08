import { z } from 'zod';
import {
  assetField,
  bloksField,
  booleanField,
  customField,
  datetimeField,
  markdownField,
  multiassetField,
  multilinkField,
  numberField,
  optionField,
  optionsField,
  richtextField,
  sectionField,
  tabField,
  tableField,
  textareaField,
  textField,
} from '../../../generated/mapi-zod-schemas';

/**
 * Union Zod schema for all field types.
 * Uses z.union (not z.discriminatedUnion) because the generated field
 * schemas are ZodIntersection types (from baseField.and(...)), which are
 * not compatible with z.discriminatedUnion in Zod v3.
 *
 * Each variant uses .passthrough() (inherited from the generated schemas),
 * so unknown keys are accepted.
 */
export const fieldSchema = z.union([
  textField,
  textareaField,
  richtextField,
  markdownField,
  numberField,
  datetimeField,
  booleanField,
  optionField,
  optionsField,
  assetField,
  multiassetField,
  multilinkField,
  bloksField,
  tableField,
  sectionField,
  tabField,
  customField,
]);

export type FieldSchema = z.infer<typeof fieldSchema>;

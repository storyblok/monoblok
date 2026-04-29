import { z } from 'zod';
import {
  assetFieldValue,
  blokContent,
  multilinkFieldValue,
  pluginFieldValue,
  richtextFieldValue,
  tableFieldValue,
} from '../../generated/zod-schemas';
import type { FieldType } from '../../helpers/define-field';

export const contentValueSchemas: Record<FieldType, z.ZodTypeAny> = {
  text: z.string(),
  textarea: z.string(),
  richtext: richtextFieldValue,
  markdown: z.string(),
  number: z.number(),
  datetime: z.string(),
  boolean: z.boolean(),
  option: z.string(),
  options: z.array(z.string()),
  asset: assetFieldValue,
  multiasset: z.array(assetFieldValue),
  multilink: multilinkFieldValue,
  bloks: z.array(blokContent),
  table: tableFieldValue,
  section: z.never(),
  tab: z.never(),
  custom: pluginFieldValue,
};

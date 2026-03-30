import { z } from 'zod';
import {
  assetField,
  multilinkField,
  pluginField,
  richtextField,
  storyContent,
  tableField,
} from '../../generated/zod-schemas';
import type { FieldType } from '../../types/field';

export const contentValueSchemas: Record<FieldType, z.ZodTypeAny> = {
  text: z.string(),
  textarea: z.string(),
  richtext: richtextField,
  markdown: z.string(),
  number: z.number(),
  datetime: z.string(),
  boolean: z.boolean(),
  option: z.string(),
  options: z.array(z.string()),
  asset: assetField,
  multiasset: z.array(assetField),
  multilink: multilinkField,
  bloks: z.array(storyContent),
  table: tableField,
  section: z.never(),
  tab: z.never(),
  custom: pluginField,
};

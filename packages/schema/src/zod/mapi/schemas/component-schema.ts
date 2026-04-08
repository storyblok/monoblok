import { z } from 'zod';
import { component as generatedComponent } from '../../../generated/mapi-zod-schemas';
import { fieldSchema } from './field-schema';

/**
 * Zod schema for a Storyblok component definition.
 */
export const componentSchema = generatedComponent.extend({
  schema: z.record(z.string(), fieldSchema),
});

export type ComponentSchema = z.infer<typeof componentSchema>;

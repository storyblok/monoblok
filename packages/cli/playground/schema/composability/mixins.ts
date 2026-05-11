import { defineBlock, defineField } from '@storyblok/schema';
import { wrap } from '../helpers';

type AnySchema = Record<string, unknown>;
type BlockInput = Parameters<typeof defineBlock>[0];

export function withTracking<T extends BlockInput>(block: T) {
  return defineBlock({
    ...block,
    schema: wrap({
      ...(block.schema as AnySchema),
      tracking_id: defineField({
        type: 'text',
        max_length: 50,
        description: 'Analytics tracking identifier',
      }),
    }),
  });
}

export function withSection<T extends BlockInput>(
  block: T,
  config: { title: string; keys: string[] },
) {
  return defineBlock({
    ...block,
    schema: wrap({
      section: defineField({
        type: 'section',
        keys: config.keys,
        fieldset: { title: config.title, collapsible: true, collapsed: false },
      }),
      ...(block.schema as AnySchema),
    }),
  });
}

import { defineBlock, defineField, defineProp } from '@storyblok/schema';

type AnySchema = Record<string, unknown>;
type BlockInput = Parameters<typeof defineBlock>[0];

export function withTracking<T extends BlockInput>(block: T) {
  const maxPos = Object.values(block.schema as AnySchema)
    .reduce<number>((max, f: any) => Math.max(max, f?.pos ?? 0), 0);

  return defineBlock({
    ...block,
    schema: {
      ...(block.schema as AnySchema),
      tracking_id: defineProp(
        defineField({
          type: 'text',
          max_length: 50,
          description: 'Analytics tracking identifier',
        }),
        { pos: maxPos + 1 },
      ),
    },
  });
}

export function withSection<T extends BlockInput>(
  block: T,
  config: { title: string; keys: string[] },
) {
  const maxPos = Object.values(block.schema as AnySchema)
    .reduce<number>((max, f: any) => Math.max(max, f?.pos ?? 0), 0);

  return defineBlock({
    ...block,
    schema: {
      section: defineProp(
        defineField({
          type: 'section',
          keys: config.keys,
          fieldset: { title: config.title, collapsible: true, collapsed: false },
        }),
        { pos: maxPos + 1 },
      ),
      ...(block.schema as AnySchema),
    },
  });
}

import { z } from 'zod';
import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock } from './define-block';
import { defineField } from './define-field';
import { defineFieldPlugin } from './define-field-plugin';
import { defineSchema } from './define-schema';
import type { Schema } from './schema-type';

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  fields: [defineField('headline', { type: 'text' })],
});

const colorPicker = defineFieldPlugin({
  fieldType: 'my-color',
  value: z.object({ color: z.string(), alpha: z.number() }),
});

describe('defineSchema', () => {
  it('derives a fieldType → validator-output map keyed by fieldType, not the record label', () => {
    const _schema = defineSchema({ blocks: { pageBlock }, fieldPlugins: { colorPicker } });
    type Map = Schema<typeof _schema>['fieldPlugins'];
    // keyed by the plugin's `fieldType` ('my-color'), not the record label ('colorPicker')
    expectTypeOf<keyof Map>().toEqualTypeOf<'my-color'>();
    expectTypeOf<Map['my-color']>().toEqualTypeOf<{ color: string; alpha: number }>();
  });

  it('derives an empty field-plugin map when none are registered', () => {
    const _schema = defineSchema({ blocks: { pageBlock } });
    expectTypeOf<Schema<typeof _schema>['fieldPlugins']>().toEqualTypeOf<Record<never, never>>();
  });
});

import type { StandardSchemaV1 } from '@standard-schema/spec';
import { z } from 'zod';
import { describe, expectTypeOf, it } from 'vitest';
import { defineFieldPlugin } from './define-field-plugin';

describe('defineFieldPlugin type inference', () => {
  it('infers the fieldType literal from the single argument', () => {
    const colorPicker = defineFieldPlugin({
      fieldType: 'my-custom-color-picker',
      value: z.object({ color: z.string(), alpha: z.number() }),
    });
    expectTypeOf(colorPicker.fieldType).toEqualTypeOf<'my-custom-color-picker'>();
  });

  it('retains the validator so its output type is recoverable', () => {
    const _colorPicker = defineFieldPlugin({
      fieldType: 'my-custom-color-picker',
      value: z.object({ color: z.string(), alpha: z.number() }),
    });
    type Output = StandardSchemaV1.InferOutput<typeof _colorPicker['value']>;
    expectTypeOf<Output>().toEqualTypeOf<{ color: string; alpha: number }>();
  });
});

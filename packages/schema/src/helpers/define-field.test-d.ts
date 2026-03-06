import { describe, expectTypeOf, it } from 'vitest';
import { defineField } from './define-field';

describe('defineField type inference', () => {
  it('should narrow type based on field type discriminant', () => {
    const f = defineField({ type: 'text', max_length: 100 });
    expectTypeOf(f.type).toEqualTypeOf<'text'>();
    expectTypeOf(f.max_length).toEqualTypeOf<number | undefined>();
  });

  it('should not include config keys from other field types', () => {
    const f = defineField({ type: 'text', max_length: 100 });
    // @ts-expect-error 'options' is not a valid key for 'text' fields
    void f.options;
  });

  it('should narrow option field type correctly', () => {
    const f = defineField({
      type: 'option',
      options: [{ name: 'Yes', value: 'yes' }],
    });
    expectTypeOf(f.type).toEqualTypeOf<'option'>();
  });

  it('should narrow number field type correctly', () => {
    const f = defineField({ type: 'number', min_value: 0, max_value: 100 });
    expectTypeOf(f.type).toEqualTypeOf<'number'>();
    expectTypeOf(f.min_value).toEqualTypeOf<number | undefined>();
  });
});

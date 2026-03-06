import { describe, expectTypeOf, it } from 'vitest';
import { defineField } from './define-field';

describe('defineField type inference', () => {
  it('should narrow type based on field type discriminant', () => {
    const f = defineField({ type: 'text', max_length: 100 });
    expectTypeOf(f.type).toEqualTypeOf<'text'>();
    // const generic preserves the literal value 100, not the widened number | undefined
    expectTypeOf(f.max_length).toEqualTypeOf<100>();
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
    // const generic preserves the literal value 0, not the widened number | undefined
    expectTypeOf(f.min_value).toEqualTypeOf<0>();
  });

  it('should preserve component_whitelist as a readonly literal tuple on bloks fields', () => {
    const f = defineField({ type: 'bloks', component_whitelist: ['teaser', 'hero'] });
    expectTypeOf(f.type).toEqualTypeOf<'bloks'>();
    // const generic infers a readonly tuple — each element is a literal string
    type CW = (typeof f)['component_whitelist'];
    expectTypeOf<CW[number]>().toEqualTypeOf<'teaser' | 'hero'>();
  });

  it('should not include component_whitelist when not provided on a bloks field', () => {
    const f = defineField({ type: 'bloks' });
    expectTypeOf(f.type).toEqualTypeOf<'bloks'>();
    // component_whitelist was not provided — it is absent from the inferred type
    // @ts-expect-error property does not exist when not supplied
    void f.component_whitelist;
  });
});

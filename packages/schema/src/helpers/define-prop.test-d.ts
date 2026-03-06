import { describe, expectTypeOf, it } from 'vitest';
import { defineField } from './define-field';
import { defineProp } from './define-prop';

describe('defineProp type inference', () => {
  it('should preserve field type and merge config', () => {
    const field = defineField({ type: 'text', max_length: 50 });
    const prop = defineProp(field, { pos: 1, required: true });
    expectTypeOf(prop.type).toEqualTypeOf<'text'>();
    expectTypeOf(prop.pos).toEqualTypeOf<number>();
    expectTypeOf(prop.required).toEqualTypeOf<true>();
  });
});

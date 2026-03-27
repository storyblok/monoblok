import { describe, expectTypeOf, it } from 'vitest';
import { defineField } from './define-field';
import { defineProp } from './define-prop';

describe('defineProp — two-arg form', () => {
  it('should preserve field type and merge config', () => {
    const field = defineField({ type: 'text', max_length: 50 });
    const prop = defineProp(field, { pos: 1, required: true });
    expectTypeOf(prop.type).toEqualTypeOf<'text'>();
    expectTypeOf(prop.pos).toEqualTypeOf<1>();
    expectTypeOf(prop.required).toEqualTypeOf<true>();
  });

  it('should preserve component_whitelist literals from defineField', () => {
    const field = defineField({ type: 'bloks', component_whitelist: ['teaser', 'hero'] as const });
    const _prop = defineProp(field, { pos: 0 });
    type CW = (typeof _prop)['component_whitelist'];
    expectTypeOf<CW[number]>().toEqualTypeOf<'teaser' | 'hero'>();
  });
});

describe('defineProp — standalone form', () => {
  it('should accept field and prop config inline', () => {
    const prop = defineProp({ type: 'text', pos: 0, required: true });
    expectTypeOf(prop.type).toEqualTypeOf<'text'>();
    expectTypeOf(prop.pos).toEqualTypeOf<0>();
    expectTypeOf(prop.required).toEqualTypeOf<true>();
  });

  it('should preserve component_whitelist literals inline', () => {
    const prop = defineProp({ type: 'bloks', component_whitelist: ['teaser', 'hero'] as const, pos: 1 });
    expectTypeOf(prop.type).toEqualTypeOf<'bloks'>();
    type CW = (typeof prop)['component_whitelist'];
    expectTypeOf<CW[number]>().toEqualTypeOf<'teaser' | 'hero'>();
  });

  it('should work without pos or required', () => {
    const prop = defineProp({ type: 'number' });
    expectTypeOf(prop.type).toEqualTypeOf<'number'>();
  });
});

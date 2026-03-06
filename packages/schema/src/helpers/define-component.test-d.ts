import { describe, expectTypeOf, it } from 'vitest';
import { defineComponent } from './define-component';
import { defineField } from './define-field';
import { defineProp } from './define-prop';

describe('defineComponent type inference', () => {
  it('should preserve literal name type', () => {
    const comp = defineComponent({
      name: 'hero',
      schema: {
        title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
      },
      id: 0,
      created_at: '',
      updated_at: '',
    });
    expectTypeOf(comp.name).toEqualTypeOf<'hero'>();
  });
});

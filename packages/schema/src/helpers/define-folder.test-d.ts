import { describe, expectTypeOf, it } from 'vitest';
import { defineFolder } from './define-folder';

describe('defineFolder types', () => {
  it('should infer the path literal through the parent chain', () => {
    const layout = defineFolder({ name: 'Layout' });
    const heros = defineFolder({ name: 'Heros', parent: layout });
    expectTypeOf(layout.path).toEqualTypeOf<'Layout'>();
    expectTypeOf(heros.path).toEqualTypeOf<'Layout/Heros'>();
  });
});

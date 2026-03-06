import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineProp } from './define-prop';
import { defineComponent } from './define-component';

describe('defineComponent', () => {
  it('should return a type safe component', () => {
    const input = {
      created_at: '',
      id: 0,
      name: 'page' as const,
      schema: {
        headline: defineProp(defineField({ type: 'text' as const }), { pos: 1 }),
      },
      updated_at: '',
    };
    const result = defineComponent(input);

    expect(result).toEqual(input);
  });
});

import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineProp } from './define-prop';

describe('defineProp', () => {
  it('should return a type safe prop', () => {
    const field = defineField({ type: 'text', max_length: 100 });
    const result = defineProp(field, { pos: 1, required: true });

    expect(result).toEqual({
      type: 'text',
      max_length: 100,
      pos: 1,
      required: true,
    });
  });
});

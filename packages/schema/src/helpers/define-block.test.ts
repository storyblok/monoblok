import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineProp } from './define-prop';
import { defineBlock } from './define-block';

describe('defineBlock', () => {
  it('should return a type safe block', () => {
    const input = {
      name: 'page',
      schema: {
        headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
      },
    };
    const result = defineBlock(input);

    expect(result).toEqual({ id: 1, created_at: '', updated_at: '', is_root: false, is_nestable: true, ...input });
  });
});

import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineBlock } from './define-block';

describe('defineBlock', () => {
  it('should return a type safe block', () => {
    const input = {
      name: 'page',
      fields: [
        defineField('headline', { type: 'text' }),
      ],
    };
    const result = defineBlock(input);

    expect(result).toEqual({
      id: 1,
      created_at: '',
      updated_at: '',
      is_root: false,
      is_nestable: true,
      name: 'page',
      fields: [
        { type: 'text', name: 'headline', pos: 0 },
      ],
    });
  });

  it('should throw when two fields share the same name', () => {
    expect(() =>
      defineBlock({
        name: 'page',
        fields: [
          defineField('headline', { type: 'text' }),
          defineField('headline', { type: 'textarea' }),
        ],
      }),
    ).toThrow(/duplicate field name "headline"/);
  });
});

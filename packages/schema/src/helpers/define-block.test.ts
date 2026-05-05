import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineBlock } from './define-block';

describe('defineBlock', () => {
  it('should return a type safe block', () => {
    const input = {
      name: 'page',
      schema: [
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
      component_group_uuid: null,
      name: 'page',
      schema: {
        headline: { type: 'text', pos: 0 },
      },
    });
  });

  it('should preserve an explicit component group uuid', () => {
    const result = defineBlock({
      name: 'page',
      component_group_uuid: 'shared-group',
      schema: [],
    });

    expect(result.component_group_uuid).toBe('shared-group');
  });

  it('should throw when two fields share the same name', () => {
    expect(() =>
      defineBlock({
        name: 'page',
        schema: [
          defineField('headline', { type: 'text' }),
          defineField('headline', { type: 'textarea' }),
        ],
      }),
    ).toThrow(/duplicate field name "headline"/);
  });
});

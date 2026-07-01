import { describe, expect, it } from 'vitest';

import type { Component } from '../../types';
import { toSchemaLike } from './to-schema-like';

function makeComponent(name: string, schema: Record<string, Record<string, unknown>>): Component {
  return {
    id: 1,
    name,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    is_root: false,
    is_nestable: true,
    schema,
  } as unknown as Component;
}

describe('toSchemaLike', () => {
  it('should convert a component schema record into a block with a fields array', () => {
    const result = toSchemaLike([
      makeComponent('hero', {
        title: { type: 'text', required: true, max_length: 50 },
        body: { type: 'bloks' },
      }),
    ]);

    expect(result.blocks).toEqual([
      {
        name: 'hero',
        fields: [
          { name: 'title', type: 'text', required: true, max_length: 50 },
          { name: 'body', type: 'bloks' },
        ],
      },
    ]);
  });

  it('should drop sentinel keys (_uid, component)', () => {
    const [block] = toSchemaLike([
      makeComponent('hero', {
        _uid: { type: 'text' },
        component: { type: 'text' },
        title: { type: 'text' },
      }),
    ]).blocks;

    expect(block.fields.map(f => f.name)).toEqual(['title']);
  });

  it('should map MAPI component_whitelist to allow', () => {
    const [block] = toSchemaLike([
      makeComponent('page', {
        body: { type: 'bloks', component_whitelist: ['hero', 'teaser'] },
      }),
    ]).blocks;

    expect(block.fields[0].allow).toEqual(['hero', 'teaser']);
  });

  it('should drop fields whose type is not a known content field type', () => {
    const [block] = toSchemaLike([
      makeComponent('hero', {
        title: { type: 'text' },
        legacy: { type: 'commerce' },
        icon: { type: 'image' },
      }),
    ]).blocks;

    expect(block.fields.map(f => f.name)).toEqual(['title']);
  });
});

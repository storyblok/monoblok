import { describe, expect, it } from 'vitest';

import {
  serializeComponent,
  serializeComponentFolder,
  serializeDatasource,
} from './serialize';

describe('serializeComponent', () => {
  it('should serialize a component to defineBlock() code', () => {
    const component = {
      id: 1,
      name: 'page',
      display_name: 'Page',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      is_root: true,
      is_nestable: false,
      schema: {
        title: {
          type: 'text',
          pos: 0,
          required: true,
        },
        body: {
          type: 'bloks',
          pos: 1,
          component_whitelist: ['hero', 'teaser'],
        },
      },
    };

    const result = serializeComponent(component);

    expect(result).toContain('defineBlock({');
    expect(result).toContain('name: \'page\',');
    expect(result).toContain('display_name: \'Page\',');
    expect(result).toContain('is_root: true,');
    expect(result).toContain('is_nestable: false,');
    expect(result).toContain('type: \'text\',');
    expect(result).toContain('type: \'bloks\',');
    // API-assigned fields must NOT appear
    expect(result).not.toContain('id:');
    expect(result).not.toContain('created_at');
    expect(result).not.toContain('updated_at');
  });

  it('should omit undefined and null optional fields', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      schema: {
        headline: { type: 'text', pos: 0 },
      },
      display_name: undefined,
      color: null,
      icon: null,
    };

    const result = serializeComponent(component);

    expect(result).toContain('name: \'hero\',');
    expect(result).not.toContain('display_name');
    expect(result).not.toContain('color');
    expect(result).not.toContain('icon');
  });

  it('should strip API-only fields but preserve user-settable fields', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      internal_tag_ids: [10, 20],
      metadata: { some: 'data' },
      schema: {
        title: { type: 'text', pos: 0, id: 'abc-123' },
        body: { type: 'bloks', pos: 1, id: 'def-456' },
      },
    };

    const result = serializeComponent(component);

    expect(result).toContain('name: \'hero\',');
    // internal_tag_ids is user-settable (in ComponentCreate/Update), so it's preserved
    expect(result).toContain('internal_tag_ids');
    // metadata is not in API types, stripped defensively
    expect(result).not.toContain('metadata');
    // Field-level id should be stripped
    expect(result).not.toContain('abc-123');
    expect(result).not.toContain('def-456');
    // But field type should remain
    expect(result).toContain('type: \'text\',');
    expect(result).toContain('type: \'bloks\',');
  });

  it('should use stable property ordering', () => {
    const component1 = {
      id: 1,
      name: 'test',
      created_at: '',
      updated_at: '',
      is_nestable: true,
      is_root: false,
      schema: { b: { type: 'text', pos: 1 }, a: { type: 'text', pos: 0 } },
    };
    const component2 = {
      id: 2,
      name: 'test',
      created_at: '',
      updated_at: '',
      is_root: false,
      is_nestable: true,
      schema: { a: { type: 'text', pos: 0 }, b: { type: 'text', pos: 1 } },
    };

    expect(serializeComponent(component1)).toBe(serializeComponent(component2));
  });
});

describe('serializeDatasource', () => {
  it('should serialize a datasource to defineDatasource() code', () => {
    const datasource = {
      id: 1,
      name: 'Categories',
      slug: 'categories',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const result = serializeDatasource(datasource);

    expect(result).toContain('defineDatasource({');
    expect(result).toContain('name: \'Categories\',');
    expect(result).toContain('slug: \'categories\',');
    expect(result).not.toContain('id:');
    expect(result).not.toContain('created_at');
  });
});

describe('serializeComponentFolder', () => {
  it('should serialize a folder to defineBlockFolder() code', () => {
    const folder = {
      id: 1,
      name: 'Layout',
      uuid: 'abc-123',
    };

    const result = serializeComponentFolder(folder);

    expect(result).toContain('defineBlockFolder({');
    expect(result).toContain('name: \'Layout\',');
    expect(result).not.toContain('id:');
    expect(result).not.toContain('uuid');
  });
});

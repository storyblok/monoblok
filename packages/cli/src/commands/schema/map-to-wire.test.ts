import { describe, expect, it } from 'vitest';

import { mapBlockToWire, mapDatasourceToWire, mapFieldToWire } from './map-to-wire';

describe('mapFieldToWire', () => {
  it('extracts the name and preserves type, pos, and validation options', () => {
    const { name, value } = mapFieldToWire({ name: 'title', type: 'text', pos: 0, max_length: 70 });
    expect(name).toBe('title');
    expect(value).toEqual({ type: 'text', pos: 0, max_length: 70 });
  });

  it('renames allow to component_whitelist', () => {
    const { value } = mapFieldToWire({ name: 'body', type: 'bloks', pos: 0, allow: ['hero', 'teaser'] });
    expect(value).toEqual({ type: 'bloks', pos: 0, component_whitelist: ['hero', 'teaser'] });
  });

  it('renames datasource to datasource_slug and keeps the source selector', () => {
    const { value } = mapFieldToWire({ name: 'theme', type: 'option', pos: 0, source: 'internal', datasource: 'colors' });
    expect(value).toEqual({ type: 'option', pos: 0, source: 'internal', datasource_slug: 'colors' });
  });
});

describe('mapBlockToWire', () => {
  it('turns the ordered fields array into a schema record and keeps block-level props', () => {
    const component = mapBlockToWire({
      name: 'page',
      is_root: true,
      is_nestable: false,
      fields: [
        { name: 'title', type: 'text', pos: 0 },
        { name: 'body', type: 'bloks', pos: 1, allow: ['hero'] },
      ],
    });

    expect(component).toEqual({
      name: 'page',
      is_root: true,
      is_nestable: false,
      schema: {
        title: { type: 'text', pos: 0 },
        body: { type: 'bloks', pos: 1, component_whitelist: ['hero'] },
      },
    });
  });

  it('produces an empty schema for a block with no fields', () => {
    const component = mapBlockToWire({ name: 'spacer', fields: [] });
    expect(component.schema).toEqual({});
  });
});

describe('mapDatasourceToWire', () => {
  it('passes the datasource definition through unchanged', () => {
    const datasource = mapDatasourceToWire({ name: 'Colors', slug: 'colors' });
    expect(datasource).toEqual({ name: 'Colors', slug: 'colors' });
  });
});

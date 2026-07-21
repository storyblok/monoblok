import { describe, expect, it } from 'vitest';

import { mapBlockToWire, mapDatasourceToWire, mapFieldToWire } from './map-to-wire';

describe('mapFieldToWire', () => {
  it('extracts the name and preserves type, pos, and validation options', () => {
    const { name, value } = mapFieldToWire({ name: 'title', type: 'text', pos: 0, max_length: 70 });
    expect(name).toBe('title');
    expect(value).toEqual({ type: 'text', pos: 0, max_length: 70 });
  });

  it('renames allow to component_whitelist and activates the restriction on bloks fields', () => {
    const { value } = mapFieldToWire({ name: 'body', type: 'bloks', pos: 0, allow: ['hero', 'teaser'] });
    expect(value).toEqual({
      type: 'bloks',
      pos: 0,
      component_whitelist: ['hero', 'teaser'],
      restrict_components: true,
      restrict_type: '',
    });
  });

  it('renames allow to component_whitelist without restriction flags on non-bloks fields', () => {
    const { value } = mapFieldToWire({ name: 'link', type: 'multilink', pos: 0, allow: ['page'] });
    expect(value).toEqual({ type: 'multilink', pos: 0, component_whitelist: ['page'] });
  });

  it('renames datasource to datasource_slug and keeps the source selector', () => {
    const { value } = mapFieldToWire({ name: 'theme', type: 'option', pos: 0, source: 'internal', datasource: 'colors' });
    expect(value).toEqual({ type: 'option', pos: 0, source: 'internal', datasource_slug: 'colors' });
  });

  it('should map folder allow entries to a group whitelist with slug paths', () => {
    const { value } = mapFieldToWire({
      name: 'body',
      type: 'bloks',
      allow: [{ folder: 'My Layout/Heros' }],
    });
    expect(value).toMatchObject({
      component_group_whitelist: ['my-layout/heros'],
      restrict_components: true,
      restrict_type: 'groups',
    });
    expect(value).not.toHaveProperty('component_whitelist');
  });

  it('should activate group restriction for richtext fields too', () => {
    const { value } = mapFieldToWire({
      name: 'text',
      type: 'richtext',
      allow: [{ folder: 'Marketing' }],
    });
    expect(value).toMatchObject({
      component_group_whitelist: ['marketing'],
      restrict_components: true,
      restrict_type: 'groups',
    });
  });

  it('should keep block-name allow mapping unchanged', () => {
    const { value } = mapFieldToWire({ name: 'body', type: 'bloks', allow: ['teaser'] });
    expect(value).toMatchObject({ component_whitelist: ['teaser'], restrict_components: true, restrict_type: '' });
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
        body: {
          type: 'bloks',
          pos: 1,
          component_whitelist: ['hero'],
          restrict_components: true,
          restrict_type: '',
        },
      },
    });
  });

  it('produces an empty schema for a block with no fields', () => {
    const component = mapBlockToWire({ name: 'spacer', fields: [] });
    expect(component.schema).toEqual({});
  });

  it('should slugify the block folder path onto the wire component', () => {
    const wire = mapBlockToWire({ name: 'hero', folder: 'My Layout/Heros', fields: [] });
    expect(wire.folder).toBe('my-layout/heros');
  });

  it('should keep folder null and absent as-is', () => {
    expect(mapBlockToWire({ name: 'a', folder: null, fields: [] }).folder).toBeNull();
    expect('folder' in mapBlockToWire({ name: 'b', fields: [] })).toBe(false);
  });
});

describe('mapDatasourceToWire', () => {
  it('passes the datasource definition through unchanged', () => {
    const datasource = mapDatasourceToWire({ name: 'Colors', slug: 'colors' });
    expect(datasource).toEqual({ name: 'Colors', slug: 'colors' });
  });
});

import { describe, expect, it } from 'vitest';

import { classifyExports, isComponent, isDatasource } from './load-schema';

describe('isComponent', () => {
  it('should return true for objects with name and a fields array', () => {
    expect(isComponent({ name: 'page', fields: [{ name: 'title', type: 'text' }] })).toBe(true);
  });

  it('should return false for objects without fields', () => {
    expect(isComponent({ name: 'folder' })).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isComponent('string')).toBe(false);
    expect(isComponent(null)).toBe(false);
    expect(isComponent(undefined)).toBe(false);
  });

  it('should return false for objects with fields but no name', () => {
    expect(isComponent({ fields: [] })).toBe(false);
  });
});

describe('isDatasource', () => {
  it('should return true for objects with name and slug', () => {
    expect(isDatasource({ name: 'Colors', slug: 'colors' })).toBe(true);
  });

  it('should return false for objects without slug', () => {
    expect(isDatasource({ name: 'Colors' })).toBe(false);
  });

  it('should return false for components (has a fields array)', () => {
    expect(isDatasource({ name: 'page', slug: 'page', fields: [] })).toBe(false);
  });
});

describe('classifyExports', () => {
  it('should classify a mixed module and map blocks to the wire schema shape', () => {
    const moduleExports = {
      pageBlock: { name: 'page', id: 1, created_at: '', updated_at: '', fields: [{ name: 'title', type: 'text', pos: 0 }] },
      heroBlock: { name: 'hero', id: 1, created_at: '', updated_at: '', fields: [{ name: 'headline', type: 'text', pos: 0 }] },
      colorsDatasource: { name: 'Colors', slug: 'colors', id: 1, created_at: '', updated_at: '' },
      headlineField: { type: 'text', max_length: 120 },
      someHelper: () => {},
      StoryblokTypes: undefined,
    };

    const result = classifyExports(moduleExports);

    expect(result.components).toHaveLength(2);
    expect(result.components[0].name).toBe('page');
    expect(result.components[0].schema).toEqual({ title: { type: 'text', pos: 0 } });
    expect(result.components[1].name).toBe('hero');
    expect(result.componentFolders).toHaveLength(0);
    expect(result.datasources).toHaveLength(1);
    expect(result.datasources[0].name).toBe('Colors');
  });

  it('should map DSL reference keys (allow, datasource) to their wire equivalents', () => {
    const moduleExports = {
      pageBlock: {
        name: 'page',
        fields: [
          { name: 'body', type: 'bloks', pos: 0, allow: ['hero', 'teaser'] },
          { name: 'theme', type: 'option', pos: 1, source: 'internal', datasource: 'colors' },
        ],
      },
    };

    const { components } = classifyExports(moduleExports);

    expect(components[0].schema).toEqual({
      body: { type: 'bloks', pos: 0, component_whitelist: ['hero', 'teaser'] },
      theme: { type: 'option', pos: 1, source: 'internal', datasource_slug: 'colors' },
    });
  });

  it('should return empty arrays when no matching exports', () => {
    const result = classifyExports({ helper: () => {}, constant: 42 });

    expect(result.components).toHaveLength(0);
    expect(result.componentFolders).toHaveLength(0);
    expect(result.datasources).toHaveLength(0);
  });

  it('should unwrap a schema object with blocks and datasources', () => {
    const moduleExports = {
      schema: {
        blocks: {
          pageBlock: { name: 'page', id: 1, created_at: '', updated_at: '', fields: [{ name: 'title', type: 'text', pos: 0 }] },
          heroBlock: { name: 'hero', id: 1, created_at: '', updated_at: '', fields: [] },
        },
        datasources: {
          colorsDatasource: { name: 'Colors', slug: 'colors', id: 1, created_at: '', updated_at: '' },
        },
      },
    };

    const result = classifyExports(moduleExports);

    expect(result.components).toHaveLength(2);
    expect(result.components[0].name).toBe('page');
    expect(result.components[1].name).toBe('hero');
    expect(result.datasources).toHaveLength(1);
    expect(result.datasources[0].name).toBe('Colors');
  });

  it('should unwrap a schema object that only has blocks (components-only space)', () => {
    const moduleExports = {
      schema: {
        blocks: {
          pageBlock: { name: 'page', id: 1, created_at: '', updated_at: '', fields: [{ name: 'title', type: 'text', pos: 0 }] },
          heroBlock: { name: 'hero', id: 1, created_at: '', updated_at: '', fields: [] },
        },
      },
    };

    const result = classifyExports(moduleExports);

    expect(result.components).toHaveLength(2);
    expect(result.components[0].name).toBe('page');
    expect(result.components[1].name).toBe('hero');
    expect(result.datasources).toHaveLength(0);
  });
});

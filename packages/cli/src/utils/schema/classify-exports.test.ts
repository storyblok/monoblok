import { describe, expect, it } from 'vitest';

import { collectSchemaExports, isComponent, isDatasource, isSchemaObject } from './classify-exports';

describe('isComponent', () => {
  it('should return true for objects with name and a fields array', () => {
    expect(isComponent({ name: 'page', fields: [{ name: 'title', type: 'text' }] })).toBe(true);
  });

  it('should return false for objects without fields', () => {
    expect(isComponent({ name: 'folder' })).toBe(false);
  });

  it('should return false for objects with fields but no name', () => {
    expect(isComponent({ fields: [] })).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isComponent('string')).toBe(false);
    expect(isComponent(null)).toBe(false);
    expect(isComponent(undefined)).toBe(false);
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

describe('isSchemaObject', () => {
  it('should return true when blocks or datasources are present', () => {
    expect(isSchemaObject({ blocks: {} })).toBe(true);
    expect(isSchemaObject({ datasources: {} })).toBe(true);
  });

  it('should return false for plain records', () => {
    expect(isSchemaObject({ name: 'page' })).toBe(false);
  });
});

describe('collectSchemaExports', () => {
  it('should collect raw component and datasource definitions', () => {
    const body = { name: 'body', type: 'bloks', allow: ['hero'] };
    const result = collectSchemaExports({
      pageBlock: { name: 'page', fields: [body] },
      colorsDatasource: { name: 'Colors', slug: 'colors' },
      helper: () => {},
    });

    expect(result.components).toHaveLength(1);
    // Definitions are returned verbatim (no wire mapping).
    expect(result.components[0]).toMatchObject({ name: 'page', fields: [body] });
    expect(result.datasources).toEqual([{ name: 'Colors', slug: 'colors' }]);
  });

  it('should collapse the same definition referenced twice (identity)', () => {
    // A block exported directly AND included in an exported `schema` object is
    // the same reference and must be collected once.
    const pageBlock = { name: 'page', fields: [] };
    const result = collectSchemaExports({
      pageBlock,
      schema: { blocks: { pageBlock } },
    });

    expect(result.components).toHaveLength(1);
  });

  it('should keep two different definitions that share a name', () => {
    // Distinct objects with the same name are a real collision; both are kept
    // so the validators can report `duplicate_block_name` (and `schema push`
    // surfaces it via MAPI) instead of silently dropping one.
    const result = collectSchemaExports({
      a: { name: 'page', fields: [] },
      b: { name: 'page', fields: [{ name: 'title', type: 'text' }] },
    });

    expect(result.components).toHaveLength(2);
    expect(result.components.map(c => c.name)).toEqual(['page', 'page']);
  });

  it('should unwrap an exported schema object', () => {
    const result = collectSchemaExports({
      schema: {
        blocks: {
          pageBlock: { name: 'page', fields: [] },
          heroBlock: { name: 'hero', fields: [] },
        },
        datasources: {
          colorsDatasource: { name: 'Colors', slug: 'colors' },
        },
      },
    });

    expect(result.components.map(c => c.name)).toEqual(['page', 'hero']);
    expect(result.datasources).toHaveLength(1);
  });

  it('should collect raw folder definitions', () => {
    const result = collectSchemaExports({
      marketingFolder: { name: 'Marketing', path: 'marketing' },
      pageBlock: { name: 'page', fields: [] },
      schema: {
        folders: { blogFolder: { name: 'Blog', path: 'blog' } },
      },
    });

    expect(result.folders).toEqual([
      { name: 'Marketing', path: 'marketing' },
      { name: 'Blog', path: 'blog' },
    ]);
    expect(result.components).toHaveLength(1);
  });

  it('should return empty arrays when nothing matches', () => {
    expect(collectSchemaExports({ helper: () => {}, constant: 42 })).toEqual({
      components: [],
      datasources: [],
      folders: [],
    });
  });
});

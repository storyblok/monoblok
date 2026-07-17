import { describe, expect, it } from 'vitest';

import { classifyExports, isComponent, isDatasource, loadSchema } from './load-schema';

describe('loadSchema', () => {
  it('should throw a clear error when the entry file does not exist', async () => {
    await expect(loadSchema('/definitely/missing/schema.ts')).rejects.toThrow(/Entry file not found/);
  });
});

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
      body: {
        type: 'bloks',
        pos: 0,
        component_whitelist: ['hero', 'teaser'],
        restrict_components: true,
        restrict_type: '',
      },
      theme: { type: 'option', pos: 1, source: 'internal', datasource_slug: 'colors' },
    });
  });

  it('should return empty arrays when no matching exports', () => {
    const result = classifyExports({ helper: () => {}, constant: 42 });

    expect(result.components).toHaveLength(0);
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

describe('classifyExports folders', () => {
  const folder = (name: string, parent?: any) => ({
    name,
    ...(parent && { parent }),
    path: parent ? `${parent.path}/${name}` : name,
  });

  it('should collect registered folders from a schema object', () => {
    const layout = folder('Layout');
    const heros = folder('Heros', layout);
    const data = classifyExports({ schema: { blocks: {}, folders: { layout, heros } } });
    expect(data.folders).toEqual([
      { name: 'Layout', path: 'layout', parentPath: null },
      { name: 'Heros', path: 'layout/heros', parentPath: 'layout' },
    ]);
  });

  it('should materialize folders from block folder paths, including prefixes', () => {
    const data = classifyExports({
      hero: { name: 'hero', folder: 'Layout/Heros', fields: [] },
    });
    expect(data.folders.map(f => f.path)).toEqual(['layout', 'layout/heros']);
  });

  it('should materialize folders from allow entries', () => {
    const data = classifyExports({
      page: {
        name: 'page',
        fields: [{ name: 'body', type: 'bloks', allow: [{ folder: 'Marketing' }] }],
      },
    });
    expect(data.folders).toEqual([{ name: 'Marketing', path: 'marketing', parentPath: null }]);
  });

  it('should dedupe by slug path with registered display name winning', () => {
    const data = classifyExports({
      myLayout: folder('My Layout'),
      hero: { name: 'hero', folder: 'my layout/Heros', fields: [] },
    });
    const root = data.folders.find(f => f.path === 'my-layout');
    expect(root?.name).toBe('My Layout');
  });

  it('should throw on conflicting registered names for the same slug path', () => {
    expect(() => classifyExports({
      a: folder('My Layout'),
      b: folder('My-Layout'),
    })).toThrow('Conflicting folder names for path "my-layout": "My Layout" vs "My-Layout"');
  });

  it('should throw on duplicate slugified leaf names under different parents', () => {
    expect(() => classifyExports({
      a: { name: 'hero', folder: 'Layout/Heros', fields: [] },
      b: { name: 'card', folder: 'Marketing/Heros', fields: [] },
    })).toThrow(/Duplicate folder name "heros" \(folders "layout\/heros" and "marketing\/heros"\): Storyblok group names must be unique per space/);
  });

  it('should not throw when the same leaf appears via dedupe of a single path', () => {
    expect(() => classifyExports({
      a: { name: 'hero', folder: 'Layout/Heros', fields: [] },
      b: { name: 'card', folder: 'layout/heros', fields: [] },
    })).not.toThrow();
  });

  it('should not classify folders as components or datasources', () => {
    const data = classifyExports({ layout: folder('Layout') });
    expect(data.components).toEqual([]);
    expect(data.datasources).toEqual([]);
  });

  it('should unwrap a schema object that only has folders', () => {
    const data = classifyExports({
      schema: {
        folders: {
          layout: { name: 'Layout', path: 'Layout' },
        },
      },
    });
    expect(data.folders).toEqual([
      { name: 'Layout', path: 'layout', parentPath: null },
    ]);
  });
});

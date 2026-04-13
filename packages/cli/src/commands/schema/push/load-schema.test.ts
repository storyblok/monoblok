import { describe, expect, it } from 'vitest';

import { classifyExports, isComponent, isComponentFolder, isDatasource } from './load-schema';

describe('isComponent', () => {
  it('should return true for objects with name and schema', () => {
    expect(isComponent({ name: 'page', schema: { title: { type: 'text' } } })).toBe(true);
  });

  it('should return false for objects without schema', () => {
    expect(isComponent({ name: 'folder' })).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isComponent('string')).toBe(false);
    expect(isComponent(null)).toBe(false);
    expect(isComponent(undefined)).toBe(false);
  });

  it('should return false for objects with schema but no name', () => {
    expect(isComponent({ schema: {} })).toBe(false);
  });
});

describe('isDatasource', () => {
  it('should return true for objects with name and slug', () => {
    expect(isDatasource({ name: 'Colors', slug: 'colors' })).toBe(true);
  });

  it('should return false for objects without slug', () => {
    expect(isDatasource({ name: 'Colors' })).toBe(false);
  });

  it('should return false for components (has schema)', () => {
    expect(isDatasource({ name: 'page', slug: 'page', schema: {} })).toBe(false);
  });
});

describe('isComponentFolder', () => {
  it('should return true for folder-shaped objects with uuid', () => {
    expect(isComponentFolder({ name: 'Layout', uuid: 'abc-123' })).toBe(true);
  });

  it('should return true for folder-shaped objects with parent_id', () => {
    expect(isComponentFolder({ name: 'Layout', parent_id: 5 })).toBe(true);
  });

  it('should return false for components', () => {
    expect(isComponentFolder({ name: 'page', schema: {} })).toBe(false);
  });

  it('should return false for datasources', () => {
    expect(isComponentFolder({ name: 'Colors', slug: 'colors' })).toBe(false);
  });
});

describe('classifyExports', () => {
  it('should classify a mixed module into components, folders, and datasources', () => {
    const moduleExports = {
      pageComponent: { name: 'page', id: 1, created_at: '', updated_at: '', schema: { title: { type: 'text' } } },
      heroComponent: { name: 'hero', id: 1, created_at: '', updated_at: '', schema: { headline: { type: 'text' } } },
      layoutFolder: { name: 'Layout', id: 1, uuid: 'Layout' },
      colorsDatasource: { name: 'Colors', slug: 'colors', id: 1, created_at: '', updated_at: '' },
      headlineField: { type: 'text', max_length: 120 },
      someHelper: () => {},
      StoryblokTypes: undefined,
    };

    const result = classifyExports(moduleExports);

    expect(result.components).toHaveLength(2);
    expect(result.components[0].name).toBe('page');
    expect(result.components[1].name).toBe('hero');
    expect(result.componentFolders).toHaveLength(1);
    expect(result.componentFolders[0].name).toBe('Layout');
    expect(result.datasources).toHaveLength(1);
    expect(result.datasources[0].name).toBe('Colors');
  });

  it('should return empty arrays when no matching exports', () => {
    const result = classifyExports({ helper: () => {}, constant: 42 });

    expect(result.components).toHaveLength(0);
    expect(result.componentFolders).toHaveLength(0);
    expect(result.datasources).toHaveLength(0);
  });

  it('should unwrap a schema object with componentFolders', () => {
    const moduleExports = {
      schema: {
        components: {
          pageComponent: { name: 'page', id: 1, created_at: '', updated_at: '', schema: { title: { type: 'text' } } },
          heroComponent: { name: 'hero', id: 1, created_at: '', updated_at: '', schema: {} },
        },
        componentFolders: {
          layoutFolder: { name: 'Layout', id: 1, uuid: 'Layout' },
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
    expect(result.componentFolders).toHaveLength(1);
    expect(result.componentFolders[0].name).toBe('Layout');
    expect(result.datasources).toHaveLength(1);
    expect(result.datasources[0].name).toBe('Colors');
  });
});

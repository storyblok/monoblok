import { describe, expect, it } from 'vitest';

import {
  componentFileName,
  componentVarName,
  datasourceVarName,
  generateComponentFile,
  generateDatasourceFile,
  generateSchemaFile,
  resolveVarNames,
} from './generate-code';

describe('generateComponentFile', () => {
  it('should generate a defineBlock() file with a fields array', () => {
    const component = {
      id: 1,
      name: 'page',
      display_name: 'Page',
      created_at: '',
      updated_at: '',
      is_root: true,
      is_nestable: false,
      schema: {
        title: { type: 'text', pos: 0, max_length: 70, required: true },
        body: { type: 'bloks', pos: 1, component_whitelist: ['hero', 'teaser'] },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('import {');
    expect(result).toContain('  defineBlock,');
    expect(result).toContain('  defineField,');
    expect(result).toContain('} from \'@storyblok/schema\';');
    expect(result).toContain('export const pageBlock = defineBlock({');
    expect(result).toContain('  name: \'page\',');
    expect(result).toContain('  is_root: true,');
    expect(result).toContain('  is_nestable: false,');
    expect(result).toContain('fields: [');
    expect(result).toContain('defineField(\'title\', {');
    expect(result).toContain('defineField(\'body\', {');
    // The field config body and its closing brace align with `defineField` (4-space
    // call indent → 6-space body, 4-space closing brace).
    expect(result).toContain('    defineField(\'title\', {\n      max_length: 70,');
    expect(result).toContain('\n    }),');
    expect(result).not.toMatch(/^\s+pos: \d/m);
    expect(result).not.toContain('id:');
    expect(result).not.toContain('created_at');
  });

  it('should reverse-map wire reference keys to the DSL form', () => {
    const component = {
      id: 1,
      name: 'page',
      created_at: '',
      updated_at: '',
      schema: {
        body: { type: 'bloks', pos: 0, component_whitelist: ['hero'] },
        theme: { type: 'option', pos: 1, source: 'internal', datasource_slug: 'colors' },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('allow: [');
    expect(result).toContain('datasource: \'colors\',');
    expect(result).toContain('source: \'internal\',');
    expect(result).not.toContain('component_whitelist');
    expect(result).not.toContain('datasource_slug');
  });

  it('should drop restrict_components and restrict_type when they accompany a component_whitelist', () => {
    const component = {
      id: 1,
      name: 'page',
      created_at: '',
      updated_at: '',
      schema: {
        body: {
          type: 'bloks',
          pos: 0,
          component_whitelist: ['hero'],
          restrict_components: true,
          restrict_type: '',
        },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('allow: [');
    expect(result).not.toContain('restrict_components');
    expect(result).not.toContain('restrict_type');
  });

  it('should keep restrict_components and restrict_type for group/tag restrictions', () => {
    const component = {
      id: 1,
      name: 'page',
      created_at: '',
      updated_at: '',
      schema: {
        body: {
          type: 'bloks',
          pos: 0,
          restrict_components: true,
          restrict_type: 'groups',
          component_group_whitelist: ['group-uuid'],
        },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('restrict_components: true,');
    expect(result).toContain('restrict_type: \'groups\',');
  });

  it('should drop component_group_uuid by default (group encoded by directory)', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      component_group_uuid: 'resolved-uuid',
      schema: {},
    };

    const result = generateComponentFile(component as any);

    expect(result).not.toContain('component_group_uuid');
  });

  it('should strip API-only fields but preserve user-settable fields', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      internal_tag_ids: [10, 20],
      metadata: { some: 'data' },
      schema: { title: { type: 'text', pos: 0 } },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('internal_tag_ids');
    expect(result).not.toContain('metadata');
    expect(result).toContain('name: \'hero\',');
  });

  it('should generate camelCase variable name from snake_case component name', () => {
    const result = generateComponentFile({ id: 1, name: 'teaser_list', created_at: '', updated_at: '', schema: {} } as any);
    expect(result).toContain('export const teaserListBlock');
  });
});

describe('generateDatasourceFile', () => {
  it('should generate a defineDatasource() file', () => {
    const datasource = { id: 1, name: 'Categories', slug: 'categories', created_at: '', updated_at: '' };

    const result = generateDatasourceFile(datasource as any);

    expect(result).toContain('import { defineDatasource } from \'@storyblok/schema\';');
    expect(result).toContain('export const categoriesDatasource = defineDatasource({');
    expect(result).toContain('  name: \'Categories\',');
    expect(result).toContain('  slug: \'categories\',');
  });
});

describe('generateSchemaFile', () => {
  it('should generate schema.ts exporting { blocks, datasources }', () => {
    const components = [{ name: 'page' }, { name: 'hero' }, { name: 'teaser_list' }] as any[];
    const datasources = [{ name: 'Categories', slug: 'categories' }] as any[];
    const groupPaths = new Map([['hero', ['Layout']]]);

    const result = generateSchemaFile(components, datasources, groupPaths);

    expect(result).toContain('import { defineSchema } from \'@storyblok/schema\';');
    expect(result).toContain('import type { Schema as InferSchema, Story as InferStory } from \'@storyblok/schema\';');
    expect(result).toContain('import { pageBlock } from \'./blocks/page\';');
    // Grouped block imported from its group subdirectory (segment verbatim)
    expect(result).toContain('import { heroBlock } from \'./blocks/Layout/hero\';');
    expect(result).toContain('import { teaserListBlock } from \'./blocks/teaser-list\';');
    expect(result).toContain('import { categoriesDatasource } from \'./datasources/categories\';');

    expect(result).toContain('export const schema = defineSchema({');
    expect(result).toContain('});');
    expect(result).toContain('  blocks: {');
    expect(result).toContain('    pageBlock,');
    expect(result).toContain('  datasources: {');
    expect(result).toContain('    categoriesDatasource,');
    expect(result).not.toContain('blockFolders');

    expect(result).toContain('export type Schema = InferSchema<typeof schema>;');
    expect(result).toContain('export type Story = InferStory<Blocks>;');
  });

  it('should omit empty sections from the schema object', () => {
    const result = generateSchemaFile([{ name: 'page' }] as any[], []);

    expect(result).toContain('  blocks: {');
    expect(result).not.toContain('  datasources: {');
  });
});

describe('componentFileName', () => {
  it('keeps well-formed names unchanged', () => {
    expect(componentFileName('teaser_list')).toBe('teaser-list');
    expect(componentFileName('page')).toBe('page');
  });

  it('strips characters that are not filesystem/shell-safe', () => {
    expect(componentFileName('Interaktion & CTAs')).toBe('interaktion-ctas');
    expect(componentFileName('A+B (C)')).toBe('a-b-c');
  });
});

describe('componentVarName / datasourceVarName', () => {
  it('keeps well-formed names unchanged', () => {
    expect(componentVarName('teaser_list')).toBe('teaserListBlock');
    expect(datasourceVarName('Categories')).toBe('categoriesDatasource');
  });

  it('strips characters that are invalid in JS identifiers', () => {
    expect(datasourceVarName('Colors & Sizes')).toBe('colorsSizesDatasource');
    expect(datasourceVarName('Colors / Sizes')).toBe('colorsSizesDatasource');
    // Symbols with no surrounding space are stripped (not treated as word
    // boundaries), so `A` and `B` merge — still a valid identifier.
    expect(datasourceVarName('A+B (C)')).toBe('abCDatasource');
  });

  it('prefixes a leading digit so the identifier is valid', () => {
    expect(datasourceVarName('123 items')).toBe('_123ItemsDatasource');
  });

  it('falls back to `_` when the name has no identifier-safe characters', () => {
    expect(datasourceVarName('&&&')).toBe('_Datasource');
  });
});

describe('resolveVarNames', () => {
  it('leaves distinct names untouched', () => {
    expect(resolveVarNames(['page', 'hero'], componentVarName))
      .toEqual(['pageBlock', 'heroBlock']);
  });

  it('appends a numeric suffix when sanitized names collide', () => {
    expect(resolveVarNames(['Colors & Sizes', 'Colors / Sizes'], datasourceVarName))
      .toEqual(['colorsSizesDatasource', 'colorsSizesDatasource2']);
  });
});

describe('generateComponentFile with explicit var name', () => {
  it('uses the provided var name for the export', () => {
    const result = generateComponentFile(
      { id: 1, name: 'hero', created_at: '', updated_at: '', schema: {} } as any,
      'heroBlock2',
    );
    expect(result).toContain('export const heroBlock2 = defineBlock({');
  });
});

describe('generateSchemaFile with colliding datasources', () => {
  it('imports and keys each datasource under a unique identifier', () => {
    const datasources = [
      { name: 'Colors & Sizes', slug: 'colors-sizes' },
      { name: 'Colors / Sizes', slug: 'colors-slash-sizes' },
    ] as any[];

    const result = generateSchemaFile([], datasources);

    expect(result).toContain('import { colorsSizesDatasource } from \'./datasources/colors-sizes\';');
    expect(result).toContain('import { colorsSizesDatasource2 } from \'./datasources/colors-slash-sizes\';');
    expect(result).toContain('    colorsSizesDatasource,');
    expect(result).toContain('    colorsSizesDatasource2,');
  });
});

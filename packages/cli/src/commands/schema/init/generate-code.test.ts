import { describe, expect, it } from 'vitest';

import {
  componentFileName,
  componentVarName,
  datasourceVarName,
  generateComponentFile,
  generateDatasourceFile,
  generateFoldersFile,
  generateSchemaFile,
  resolveComponents,
  resolveDatasources,
  resolveFileNames,
  resolveFolders,
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

  it('should escape backslashes and newlines in field values so the output round-trips', () => {
    const component = {
      id: 1,
      name: 'vimeo-video',
      created_at: '',
      updated_at: '',
      description: 'The identifier can be found here:\nhttps://vimeo.com/<id>',
      schema: {
        videoId: {
          type: 'text',
          pos: 0,
          regex: String.raw`^\s*\b\w+(?:\s+\w+){0,3}\s*$`,
        },
      },
    };

    const result = generateComponentFile(component as any);

    // Backslashes are escaped so the regex survives byte-for-byte (was silently
    // corrupted to `^s*w+...` when only single quotes were escaped).
    expect(result).toContain(String.raw`regex: '^\\s*\\b\\w+(?:\\s+\\w+){0,3}\\s*$',`);
    // The multiline description is escaped instead of breaking the parse.
    expect(result).toContain(String.raw`description: 'The identifier can be found here:\nhttps://vimeo.com/<id>',`);
    // No raw line break leaks into a string literal.
    expect(result).not.toContain('found here:\n');
  });

  it('should escape single quotes in field names', () => {
    const component = {
      id: 1,
      name: 'page',
      created_at: '',
      updated_at: '',
      schema: {
        'it\'s': { type: 'text', pos: 0 },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('defineField(\'it\\\'s\', {');
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

  it('should resolve a group whitelist to allow: [folderVar] and import the folder when uuids are known', () => {
    const component = {
      id: 1,
      name: 'landing',
      created_at: '',
      updated_at: '',
      schema: {
        body: {
          type: 'bloks',
          pos: 0,
          restrict_components: true,
          restrict_type: 'groups',
          component_group_whitelist: ['uuid-heros'],
        },
      },
    };

    const result = generateComponentFile(
      component as any,
      undefined,
      undefined,
      new Map([['uuid-heros', 'herosFolder']]),
    );

    expect(result).toContain('import { herosFolder } from \'../folders\';');
    expect(result).toContain('allow: [');
    expect(result).toContain('herosFolder,');
    expect(result).not.toContain('herosFolder\'');
    expect(result).not.toContain('component_group_whitelist');
    expect(result).not.toContain('restrict_type');
    expect(result).not.toContain('restrict_components');
  });

  it('should resolve a group whitelist to allow refs even when an empty component_whitelist accompanies it', () => {
    // A field restricted to a group carries an empty `component_whitelist: []`
    // alongside the `component_group_whitelist` on the wire; the group refs must
    // win rather than the empty name whitelist producing `allow: []`.
    const component = {
      id: 1,
      name: 'grid',
      created_at: '',
      updated_at: '',
      schema: {
        columns: {
          type: 'bloks',
          pos: 0,
          restrict_components: true,
          restrict_type: 'groups',
          component_whitelist: [],
          component_group_whitelist: ['uuid-heros'],
        },
      },
    };

    const result = generateComponentFile(
      component as any,
      undefined,
      undefined,
      new Map([['uuid-heros', 'herosFolder']]),
    );

    expect(result).toContain('import { herosFolder } from \'../folders\';');
    expect(result).toContain('allow: [');
    expect(result).toContain('herosFolder,');
    expect(result).not.toContain('allow: []');
    expect(result).not.toContain('component_whitelist');
    expect(result).not.toContain('component_group_whitelist');
  });

  it('should drop orphaned restrict flags when a restricted field has no names and no groups', () => {
    // `restrict_components: true` with an empty `component_whitelist` and no group
    // whitelist is a wire byproduct that `allow` re-derives on push; without an
    // allow to back it, it must not be emitted as orphaned DSL state.
    const component = {
      id: 1,
      name: 'landing',
      created_at: '',
      updated_at: '',
      schema: {
        body: {
          type: 'bloks',
          pos: 0,
          restrict_components: true,
          component_whitelist: [],
        },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('defineField(\'body\', {');
    expect(result).not.toContain('restrict_components');
    expect(result).not.toContain('component_whitelist');
    expect(result).not.toContain('allow');
  });

  it('should omit empty array fields on blocks and fields', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      internal_tag_ids: [],
      schema: {
        body: { type: 'bloks', pos: 0, component_whitelist: [] },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).not.toContain('internal_tag_ids');
    expect(result).not.toContain('component_whitelist');
    expect(result).not.toContain('allow: []');
    expect(result).not.toContain(': [],');
  });

  it('should keep a raw group whitelist when a uuid has no known folder var', () => {
    const component = {
      id: 1,
      name: 'landing',
      created_at: '',
      updated_at: '',
      schema: {
        body: {
          type: 'bloks',
          pos: 0,
          restrict_components: true,
          restrict_type: 'groups',
          component_group_whitelist: ['uuid-unknown'],
        },
      },
    };

    const result = generateComponentFile(component as any, undefined, undefined, new Map([['uuid-heros', 'herosFolder']]));

    expect(result).toContain('component_group_whitelist');
    expect(result).toContain('restrict_type: \'groups\',');
    expect(result).not.toContain('from \'../folders\'');
  });

  it('should combine the block\'s own folder and a whitelist folder into one import at the right depth', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      component_group_uuid: 'uuid-heros',
      schema: {
        related: {
          type: 'bloks',
          pos: 0,
          restrict_components: true,
          restrict_type: 'groups',
          component_group_whitelist: ['uuid-marketing'],
        },
      },
    };

    const result = generateComponentFile(
      component as any,
      undefined,
      { varName: 'herosFolder', segments: ['layout', 'heros'] },
      new Map([['uuid-heros', 'herosFolder'], ['uuid-marketing', 'marketingFolder']]),
    );

    // Block lives at blocks/layout/heros/hero.ts -> three levels up to folders.ts.
    expect(result).toContain('import { herosFolder, marketingFolder } from \'../../../folders\';');
    expect(result).toContain('folder: herosFolder,');
    expect(result).toContain('allow: [');
    expect(result).toContain('marketingFolder,');
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

    const result = generateSchemaFile(
      resolveComponents(components, [[], ['Layout'], []]),
      resolveDatasources(datasources),
    );

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
    const result = generateSchemaFile(
      resolveComponents([{ name: 'page' }] as any[], [[]]),
      resolveDatasources([]),
    );

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

describe('resolveFileNames', () => {
  it('leaves distinct file names untouched', () => {
    expect(resolveFileNames(['page', 'hero'])).toEqual(['page', 'hero']);
  });

  it('appends a -N suffix when kebab-collapsed names collide', () => {
    // `hero_cta` and `hero-cta` both kebab to `hero-cta`.
    expect(resolveFileNames(['hero-cta', 'hero-cta', 'hero-cta']))
      .toEqual(['hero-cta', 'hero-cta-2', 'hero-cta-3']);
  });

  it('scopes uniqueness per directory so different dirs may share a name', () => {
    // Same file name in different group directories does not collide on disk.
    expect(resolveFileNames(['hero', 'hero', 'hero'], ['group-a', 'group-b', 'group-a']))
      .toEqual(['hero', 'hero', 'hero-2']);
  });
});

describe('generateSchemaFile with colliding block file names', () => {
  it('imports each block from a unique path scoped per group directory', () => {
    // `hero_cta` and `hero-cta` are distinct component names that both kebab to
    // `hero-cta`; ungrouped, so they share the blocks root and must not collide.
    const components = [
      { id: 1, name: 'hero_cta', created_at: '', updated_at: '', schema: {} },
      { id: 2, name: 'hero-cta', created_at: '', updated_at: '', schema: {} },
    ] as any[];

    const result = generateSchemaFile(resolveComponents(components, [[], []]), resolveDatasources([]));

    expect(result).toContain('from \'./blocks/hero-cta\';');
    expect(result).toContain('from \'./blocks/hero-cta-2\';');
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

describe('resolveFolders / generateFoldersFile', () => {
  it('should generate a folders.ts with nested defineFolder consts, parent-first', () => {
    const layout = { id: 1, uuid: 'u1', name: 'Layout', parent_id: null, parent_uuid: null };
    const heros = { id: 2, uuid: 'u2', name: 'Heros', parent_id: 1, parent_uuid: 'u1' };
    const resolved = resolveFolders([heros, layout] as any); // input order must not matter
    const code = generateFoldersFile(resolved);

    expect(code).toContain('import { defineFolder } from \'@storyblok/schema\';');
    expect(code).toContain(`export const layoutFolder = defineFolder({\n  name: 'Layout',\n});`);
    expect(code).toContain(`export const herosFolder = defineFolder({\n  name: 'Heros',\n  parent: layoutFolder,\n});`);
    expect(code.indexOf('layoutFolder')).toBeLessThan(code.indexOf('herosFolder'));
  });

  it('dedupes folder var names via resolveVarNames', () => {
    const a = { id: 1, uuid: 'u1', name: 'Colors & Sizes', parent_id: null, parent_uuid: null };
    const b = { id: 2, uuid: 'u2', name: 'Colors / Sizes', parent_id: null, parent_uuid: null };
    const resolved = resolveFolders([a, b] as any);

    expect(resolved.map(r => r.varName)).toEqual(['colorsSizesFolder', 'colorsSizesFolder2']);
  });
});

describe('generateComponentFile with a folder ref', () => {
  it('should emit folder refs on grouped component files', () => {
    const component = { name: 'hero', schema: {}, component_group_uuid: 'u2' } as any;
    const code = generateComponentFile(component, 'heroBlock', { varName: 'herosFolder', segments: ['layout', 'heros'] });

    expect(code).toContain('import { herosFolder } from \'../../../folders\';');
    expect(code).toContain('folder: herosFolder,');
    expect(code).not.toContain('component_group_uuid');
  });

  it('should not emit a folder import or ref for ungrouped components', () => {
    const component = { name: 'hero', schema: {} } as any;
    const code = generateComponentFile(component, 'heroBlock');

    expect(code).not.toContain('folders\';');
    expect(code).not.toContain('folder:');
  });

  it('uses a single \'../folders\' import for a root-level grouped block', () => {
    const component = { name: 'hero', schema: {}, component_group_uuid: 'u1' } as any;
    const code = generateComponentFile(component, 'heroBlock', { varName: 'layoutFolder', segments: ['layout'] });

    expect(code).toContain('import { layoutFolder } from \'../../folders\';');
  });
});

describe('generateSchemaFile with folders', () => {
  it('should register folders in the generated schema file', () => {
    const layout = { id: 1, uuid: 'u1', name: 'Layout', parent_id: null, parent_uuid: null };
    const resolvedFolders = resolveFolders([layout] as any);

    const result = generateSchemaFile(
      resolveComponents([], []),
      resolveDatasources([]),
      resolvedFolders,
    );

    expect(result).toContain('import { layoutFolder } from \'./folders\';');
    expect(result).toContain('  folders: {');
    expect(result).toContain('    layoutFolder,');
  });

  it('should omit folders from schema.ts when there are none', () => {
    const result = generateSchemaFile(resolveComponents([], []), resolveDatasources([]));

    expect(result).not.toContain('folders:');
    expect(result).not.toContain('./folders');
  });
});

describe('generateSchemaFile with colliding datasources', () => {
  it('imports and keys each datasource under a unique identifier', () => {
    const datasources = [
      { name: 'Colors & Sizes', slug: 'colors-sizes' },
      { name: 'Colors / Sizes', slug: 'colors-slash-sizes' },
    ] as any[];

    const result = generateSchemaFile(resolveComponents([], []), resolveDatasources(datasources));

    expect(result).toContain('import { colorsSizesDatasource } from \'./datasources/colors-sizes\';');
    expect(result).toContain('import { colorsSizesDatasource2 } from \'./datasources/colors-slash-sizes\';');
    expect(result).toContain('    colorsSizesDatasource,');
    expect(result).toContain('    colorsSizesDatasource2,');
  });

  it('imports each datasource from a unique path when slugs kebab-collapse to the same file name', () => {
    // Distinct slugs `colors-sizes` and `colors_sizes` both kebab to `colors-sizes`.
    const datasources = [
      { name: 'Colors A', slug: 'colors-sizes' },
      { name: 'Colors B', slug: 'colors_sizes' },
    ] as any[];

    const result = generateSchemaFile(resolveComponents([], []), resolveDatasources(datasources));

    expect(result).toContain('from \'./datasources/colors-sizes\';');
    expect(result).toContain('from \'./datasources/colors-sizes-2\';');
  });
});

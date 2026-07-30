import { describe, expect, it } from 'vitest';

import { buildNames, renderSchemaTypes, renderSeparateFiles, toRelativeImport } from './render';

const heroBlock = {
  componentName: 'hero',
  definitionBody: '{\n  name: \'hero\';\n  fields: [];\n}',
  customFieldTypes: [],
};
const teaserListBlock = {
  componentName: 'teaser_list',
  definitionBody: '{\n  name: \'teaser_list\';\n  fields: [];\n}',
  customFieldTypes: [],
};

describe('buildNames', () => {
  it('derives PascalCase definition names and the shared surface names', () => {
    const names = buildNames(['hero', 'teaser_list'], {});

    expect(names.definitionByComponent.get('hero')).toBe('HeroBlockDefinition');
    expect(names.definitionByComponent.get('teaser_list')).toBe('TeaserListBlockDefinition');
    expect(names.blocks).toBe('Blocks');
    expect(names.block).toBe('Block');
    expect(names.schema).toBe('Schema');
  });

  it('applies prefix and suffix to every emitted name', () => {
    const names = buildNames(['hero'], { typePrefix: 'Sb', typeSuffix: 'Type' });

    expect(names.definitionByComponent.get('hero')).toBe('SbHeroBlockDefinitionType');
    expect(names.blocks).toBe('SbBlocksType');
    expect(names.block).toBe('SbBlockType');
    expect(names.schema).toBe('SbSchemaType');
    expect(names.fieldPlugins).toBe('SbFieldPluginsType');
    expect(names.anyBlock).toBe('SbAnyBlockType');
    expect(names.story).toBe('SbStoryType');
    expect(names.storyMapi).toBe('SbStoryMapiType');
  });

  it('disambiguates components that collapse to the same PascalCase name', () => {
    const names = buildNames(['teaser-list', 'teaser_list'], {});

    const first = names.definitionByComponent.get('teaser-list');
    const second = names.definitionByComponent.get('teaser_list');
    expect(first).not.toBe(second);
    expect([first, second]).toContain('TeaserListBlockDefinition');
  });

  it('keeps a component name starting with a digit a valid identifier', () => {
    const names = buildNames(['2_col'], {});

    expect(names.definitionByComponent.get('2_col')).toBe('_2ColBlockDefinition');
  });

  it('keeps a digit-leading name valid under a prefix and suffix', () => {
    const names = buildNames(['2_col'], { typePrefix: 'Sb', typeSuffix: 'Type' });

    expect(names.definitionByComponent.get('2_col')).toBe('Sb_2ColBlockDefinitionType');
  });
});

describe('renderSchemaTypes', () => {
  it('emits the definition types and the shared surface', () => {
    const output = renderSchemaTypes({
      blocks: [heroBlock, teaserListBlock],
      fieldPlugins: { kind: 'none' },
      space: '295018',
    });

    expect(output).toContain('import type { BlockContent, MapiStory as InferStoryMapi, Story as InferStory } from \'@storyblok/schema\';');
    expect(output).not.toContain('InferSchema');
    expect(output).toContain('export type HeroBlockDefinition = {');
    expect(output).toContain('export type Blocks = HeroBlockDefinition | TeaserListBlockDefinition;');
    expect(output).toContain('export type FieldPlugins = Record<never, never>;');
    expect(output).toContain('export type Schema = { blocks: Blocks; fieldPlugins: FieldPlugins };');
    expect(output).toContain('export type Block<TName extends Blocks[\'name\']> = BlockContent<Extract<Blocks, { name: TName }>, Blocks, FieldPlugins>;');
    expect(output).toContain('export type AnyBlock = BlockContent<Blocks, Blocks, FieldPlugins>;');
    expect(output).toContain('export type Story = InferStory<Blocks, FieldPlugins>;');
    expect(output).toContain('export type StoryMapi = InferStoryMapi<Blocks, FieldPlugins>;');
  });

  it('renames internal references consistently with prefixed declarations', () => {
    const output = renderSchemaTypes({
      blocks: [heroBlock],
      fieldPlugins: { kind: 'none' },
      space: '295018',
      typePrefix: 'Storyblok',
    });

    expect(output).toContain('export type StoryblokBlocks = StoryblokHeroBlockDefinition;');
    expect(output).toContain('export type StoryblokSchema = { blocks: StoryblokBlocks; fieldPlugins: StoryblokFieldPlugins };');
    expect(output).toContain('export type StoryblokBlock<TName extends StoryblokBlocks[\'name\']> = BlockContent<Extract<StoryblokBlocks, { name: TName }>, StoryblokBlocks, StoryblokFieldPlugins>;');
    // the @storyblok/schema import aliases are file-internal and must not be renamed
    expect(output).toContain('MapiStory as InferStoryMapi');
  });

  it('derives FieldPlugins from a defineSchema result', () => {
    const output = renderSchemaTypes({
      blocks: [heroBlock],
      fieldPlugins: { kind: 'schema', modulePath: '/abs/schema.ts', fieldTypes: ['x'] },
      fieldPluginsImportPath: '../../schema/schema',
      space: '295018',
    });

    expect(output).toContain('import type { BlockContent, MapiStory as InferStoryMapi, Schema as InferSchema, Story as InferStory } from \'@storyblok/schema\';');
    expect(output).toContain('import type { schema as userSchema } from \'../../schema/schema\';');
    expect(output).toContain('export type FieldPlugins = InferSchema<typeof userSchema>[\'fieldPlugins\'];');
  });

  it('derives FieldPlugins from a bare fieldPlugins record', () => {
    const output = renderSchemaTypes({
      blocks: [heroBlock],
      fieldPlugins: { kind: 'record', modulePath: '/abs/plugins.ts', fieldTypes: ['x'] },
      fieldPluginsImportPath: './plugins',
      space: '295018',
    });

    expect(output).toContain('import type { BlockContent, MapiStory as InferStoryMapi, Schema as InferSchema, Story as InferStory } from \'@storyblok/schema\';');
    expect(output).toContain('import type { fieldPlugins as userFieldPlugins } from \'./plugins\';');
    expect(output).toContain('export type FieldPlugins = InferSchema<{ blocks: Record<string, never>; fieldPlugins: typeof userFieldPlugins }>[\'fieldPlugins\'];');
  });

  it('declares and references a digit-leading component under its safe name', () => {
    const output = renderSchemaTypes({
      blocks: [{ componentName: '2_col', definitionBody: '{}', customFieldTypes: [] }, heroBlock],
      fieldPlugins: { kind: 'none' },
      space: '295018',
    });

    // A bare `2ColBlockDefinition` is a syntax error that takes the whole file
    // with it, so the declaration and the union must both use the guarded name.
    expect(output).toContain('export type _2ColBlockDefinition = {}');
    expect(output).toContain('export type Blocks = _2ColBlockDefinition | HeroBlockDefinition;');
    expect(output).not.toMatch(/\b2ColBlockDefinition/);
  });

  it('records the space in the generated header', () => {
    const output = renderSchemaTypes({ blocks: [heroBlock], fieldPlugins: { kind: 'none' }, space: '295018' });

    expect(output.startsWith('// This file was generated by the Storyblok CLI. Do not edit by hand.')).toBe(true);
    expect(output).toContain('// Space: 295018');
  });
});

describe('toRelativeImport', () => {
  it('builds a posix relative specifier with a javascript extension', () => {
    expect(toRelativeImport('/p/.storyblok/types/1', '/p/.storyblok/schema/schema.ts')).toBe('../../schema/schema.js');
  });

  it('prefixes a sibling path with ./', () => {
    expect(toRelativeImport('/p/types', '/p/types/plugins.ts')).toBe('./plugins.js');
  });

  // An extension-less specifier is TS2835 under node16/nodenext in an ESM
  // package, and the emitted file is generated code the user cannot repair.
  it('keeps the specifier resolvable under node16 by never emitting a bare path', () => {
    expect(toRelativeImport('/p/types', '/p/plugins.tsx')).toBe('../plugins.js');
    expect(toRelativeImport('/p/types', '/p/plugins.mts')).toBe('../plugins.mjs');
    expect(toRelativeImport('/p/types', '/p/plugins.cts')).toBe('../plugins.cjs');
  });

  it('leaves a module that already has a javascript extension alone', () => {
    expect(toRelativeImport('/p/types', '/p/plugins.js')).toBe('../plugins.js');
    expect(toRelativeImport('/p/types', '/p/plugins.mjs')).toBe('../plugins.mjs');
  });
});

describe('renderSeparateFiles', () => {
  /**
   * Guards the invariant at the level that matters, rather than per call site:
   * every relative specifier the renderer emits must carry a JavaScript
   * extension. An extension-less one is TS2834 under node16/node18/nodenext in
   * an ESM package, which is every modern Node-ESM project, and the user is told
   * not to edit generated types so they cannot repair it. This previously
   * regressed because the block imports were built inline instead of going
   * through a helper, so assert over the emitted text.
   */
  it('emits no extension-less relative import in any file, in either mode', () => {
    const options = {
      blocks: [heroBlock, teaserListBlock],
      fieldPlugins: { kind: 'record' as const, modulePath: '/abs/plugins.ts', fieldTypes: ['colorpicker'] },
      fieldPluginsImportPath: '../../schema/plugins.js',
      space: '295018',
    };

    const emitted = [
      ...renderSeparateFiles({ ...options, filename: 'storyblok-schema' }).values(),
      renderSchemaTypes(options),
    ];

    const specifiers = emitted.flatMap(content => [...content.matchAll(/from '(\.[^']*)'/g)].map(match => match[1]));

    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter(specifier => !/\.(?:js|mjs|cjs)$/.test(specifier))).toEqual([]);
  });

  it('writes one definition per block file and imports them in the main file', () => {
    const files = renderSeparateFiles({
      blocks: [heroBlock, teaserListBlock],
      fieldPlugins: { kind: 'none' },
      space: '295018',
      filename: 'storyblok-schema',
    });

    expect([...files.keys()].sort()).toEqual([
      'blocks/hero.d.ts',
      'blocks/teaser-list.d.ts',
      'storyblok-schema.d.ts',
    ]);

    expect(files.get('blocks/hero.d.ts')).toContain('export type HeroBlockDefinition = {');
    expect(files.get('storyblok-schema.d.ts')).toContain('import type { HeroBlockDefinition } from \'./blocks/hero.js\';');
    expect(files.get('storyblok-schema.d.ts')).toContain('import type { TeaserListBlockDefinition } from \'./blocks/teaser-list.js\';');
    expect(files.get('storyblok-schema.d.ts')).toContain('export type Blocks = HeroBlockDefinition | TeaserListBlockDefinition;');
    expect(files.get('storyblok-schema.d.ts')).not.toContain('export type HeroBlockDefinition = {');
  });

  it('uses the safe name in both the block file and the main file import', () => {
    const files = renderSeparateFiles({
      blocks: [{ componentName: '2_col', definitionBody: '{}', customFieldTypes: [] }],
      fieldPlugins: { kind: 'none' },
      space: '295018',
      filename: 'storyblok-schema',
    });

    expect(files.get('blocks/2-col.d.ts')).toContain('export type _2ColBlockDefinition = {}');
    expect(files.get('storyblok-schema.d.ts')).toContain('import type { _2ColBlockDefinition } from \'./blocks/2-col.js\';');
    expect(files.get('storyblok-schema.d.ts')).not.toMatch(/\b2ColBlockDefinition/);
  });

  it('disambiguates block file names that collide after kebab-casing', () => {
    const files = renderSeparateFiles({
      blocks: [
        { componentName: 'teaser-list', definitionBody: '{}', customFieldTypes: [] },
        { componentName: 'teaser_list', definitionBody: '{}', customFieldTypes: [] },
      ],
      fieldPlugins: { kind: 'none' },
      space: '295018',
      filename: 'storyblok-schema',
    });

    expect([...files.keys()].sort()).toEqual([
      'blocks/teaser-list-2.d.ts',
      'blocks/teaser-list.d.ts',
      'storyblok-schema.d.ts',
    ]);
  });

  it('carries the field-plugins import into the main file only', () => {
    const files = renderSeparateFiles({
      blocks: [heroBlock],
      fieldPlugins: { kind: 'record', modulePath: '/abs/plugins.ts', fieldTypes: ['x'] },
      fieldPluginsImportPath: './plugins',
      space: '295018',
      filename: 'storyblok-schema',
    });

    expect(files.get('storyblok-schema.d.ts')).toContain('import type { fieldPlugins as userFieldPlugins } from \'./plugins\';');
    expect(files.get('blocks/hero.d.ts')).not.toContain('userFieldPlugins');
  });
});

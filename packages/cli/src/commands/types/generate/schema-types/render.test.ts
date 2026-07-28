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

  it('records the space in the generated header', () => {
    const output = renderSchemaTypes({ blocks: [heroBlock], fieldPlugins: { kind: 'none' }, space: '295018' });

    expect(output.startsWith('// This file was generated by the Storyblok CLI. Do not edit by hand.')).toBe(true);
    expect(output).toContain('// Space: 295018');
  });
});

describe('toRelativeImport', () => {
  it('builds a posix relative specifier without the extension', () => {
    expect(toRelativeImport('/p/.storyblok/types/1', '/p/.storyblok/schema/schema.ts')).toBe('../../schema/schema');
  });

  it('prefixes a sibling path with ./', () => {
    expect(toRelativeImport('/p/types', '/p/types/plugins.ts')).toBe('./plugins');
  });
});

describe('renderSeparateFiles', () => {
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
    expect(files.get('storyblok-schema.d.ts')).toContain('import type { HeroBlockDefinition } from \'./blocks/hero\';');
    expect(files.get('storyblok-schema.d.ts')).toContain('import type { TeaserListBlockDefinition } from \'./blocks/teaser-list\';');
    expect(files.get('storyblok-schema.d.ts')).toContain('export type Blocks = HeroBlockDefinition | TeaserListBlockDefinition;');
    expect(files.get('storyblok-schema.d.ts')).not.toContain('export type HeroBlockDefinition = {');
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

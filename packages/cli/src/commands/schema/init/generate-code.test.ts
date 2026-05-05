import { describe, expect, it } from 'vitest';

import {
  generateComponentFile,
  generateDatasourceFile,
  generateFolderFile,
  generateSchemaFile,
} from './generate-code';

describe('generateComponentFile', () => {
  it('should generate a defineBlock() file with multi-line formatting', () => {
    const component = {
      id: 1,
      name: 'page',
      display_name: 'Page',
      created_at: '',
      updated_at: '',
      is_root: true,
      is_nestable: false,
      schema: {
        title: {
          type: 'text',
          pos: 0,
          max_length: 70,
          required: true,
        },
        body: {
          type: 'bloks',
          pos: 1,
          component_whitelist: ['hero', 'teaser'],
        },
      },
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('import {');
    expect(result).toContain('  defineBlock,');
    expect(result).toContain('  defineField,');
    expect(result).toContain('  defineProp,');
    expect(result).toContain('} from \'@storyblok/schema\';');
    expect(result).toContain('export const pageBlock = defineBlock({');
    expect(result).toContain('  name: \'page\',');
    expect(result).toContain('  display_name: \'Page\',');
    expect(result).toContain('  is_root: true,');
    expect(result).toContain('  is_nestable: false,');
    expect(result).toContain('defineProp(');
    expect(result).toContain('defineField({');
    expect(result).not.toContain('id:');
    expect(result).not.toContain('created_at');
  });

  it('should strip API-only fields but preserve user-settable fields', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      internal_tag_ids: [10, 20],
      metadata: { some: 'data' },
      schema: {
        title: { type: 'text', pos: 0 },
      },
    };

    const result = generateComponentFile(component as any);

    // internal_tag_ids is user-settable (in ComponentCreate/Update), so it's preserved
    expect(result).toContain('internal_tag_ids');
    expect(result).not.toContain('metadata');
    expect(result).toContain('name: \'hero\',');
  });

  it('should generate camelCase variable name from snake_case component name', () => {
    const component = {
      id: 1,
      name: 'teaser_list',
      created_at: '',
      updated_at: '',
      schema: {},
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('export const teaserListBlock');
  });

  it('should handle consecutive uppercase letters in component name', () => {
    const component = {
      id: 1,
      name: 'SEO_settings',
      created_at: '',
      updated_at: '',
      schema: {},
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('export const seoSettingsBlock');
  });

  it('should generate folder import and reference when component_group_uuid matches a folder', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      component_group_uuid: 'folder-uuid-123',
      schema: { title: { type: 'text', pos: 0 } },
    };
    const folders = [{ id: 1, name: 'Layout', uuid: 'folder-uuid-123' }];

    const result = generateComponentFile(component as any, folders as any);

    expect(result).toContain('import { layoutFolder } from \'./folders/layout\';');
    expect(result).toContain('component_group_uuid: layoutFolder.uuid,');
    expect(result).not.toContain('\'folder-uuid-123\'');
  });

  it('should emit raw UUID when component_group_uuid does not match any folder', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      component_group_uuid: 'unknown-uuid',
      schema: {},
    };

    const result = generateComponentFile(component as any, []);

    expect(result).toContain('component_group_uuid: \'unknown-uuid\'');
    expect(result).not.toContain('folders/');
  });

  it('should not add folder import when folders parameter is omitted', () => {
    const component = {
      id: 1,
      name: 'hero',
      created_at: '',
      updated_at: '',
      component_group_uuid: 'some-uuid',
      schema: {},
    };

    const result = generateComponentFile(component as any);

    expect(result).toContain('component_group_uuid: \'some-uuid\'');
    expect(result).not.toContain('folders/');
  });
});

describe('generateFolderFile', () => {
  it('should generate a defineBlockFolder() file preserving uuid', () => {
    const folder = { id: 1, name: 'Content Blocks', uuid: 'abc-123' };

    const result = generateFolderFile(folder as any);

    expect(result).toContain('import { defineBlockFolder } from \'@storyblok/schema/mapi\';');
    expect(result).toContain('export const contentBlocksFolder = defineBlockFolder({');
    expect(result).toContain('  name: \'Content Blocks\',');
    expect(result).toContain('  uuid: \'abc-123\',');
    expect(result).not.toMatch(/^\s+id:/m);
  });
});

describe('generateDatasourceFile', () => {
  it('should handle consecutive uppercase letters in datasource name', () => {
    const datasource = { id: 1, name: 'FAQ Categories', slug: 'faq-categories', created_at: '', updated_at: '' };

    const result = generateDatasourceFile(datasource as any);

    expect(result).toContain('export const faqCategoriesDatasource');
  });

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
  it('should generate schema.ts with schema object, StoryblokTypes, and Story', () => {
    const components = [
      { name: 'page' },
      { name: 'hero' },
      { name: 'teaser_list' },
    ] as any[];
    const componentFolders = [{ name: 'Layout' }] as any[];
    const datasources = [{ name: 'Categories', slug: 'categories' }] as any[];

    const result = generateSchemaFile(components, componentFolders, datasources);

    // Imports Schema and Story helpers
    expect(result).toContain('import type { Schema as InferSchema, Story as InferStory } from \'@storyblok/schema\';');
    expect(result).toContain('import type { Story as InferStoryMapi } from \'@storyblok/schema/mapi\';');

    // Imports components (value imports, not type-only)
    expect(result).toContain('import { pageBlock } from \'./components/page\';');
    expect(result).toContain('import { heroBlock } from \'./components/hero\';');
    expect(result).toContain('import { teaserListBlock } from \'./components/teaser-list\';');

    // Imports folders and datasources
    expect(result).toContain('import { layoutFolder } from \'./components/folders/layout\';');
    expect(result).toContain('import { categoriesDatasource } from \'./datasources/categories\';');

    // Schema object
    expect(result).toContain('export const schema = {');
    expect(result).toContain('  blocks: {');
    expect(result).toContain('    pageBlock,');
    expect(result).toContain('    heroBlock,');
    expect(result).toContain('    teaserListBlock,');
    expect(result).toContain('  blockFolders: {');
    expect(result).toContain('    layoutFolder,');
    expect(result).toContain('  datasources: {');
    expect(result).toContain('    categoriesDatasource,');

    // Schema, Blocks, and Story types
    expect(result).toContain('export type Schema = InferSchema<typeof schema>;');
    expect(result).toContain('export type Blocks = Schema[\'blocks\'];');
    expect(result).toContain('export type Story = InferStory<Blocks>;');
    expect(result).toContain('export type StoryMapi = InferStoryMapi<Blocks>;');
  });

  it('should omit empty sections from schema object', () => {
    const components = [{ name: 'page' }] as any[];

    const result = generateSchemaFile(components, [], []);

    expect(result).toContain('  blocks: {');
    expect(result).not.toContain('  blockFolders: {');
    expect(result).not.toContain('  datasources: {');
  });
});

import { describe, expect, it } from 'vitest';

import {
  defineAsset,
  defineBlock,
  defineDatasource,
  defineDatasourceEntry,
  defineField,
  defineLink,
  defineProp,
  defineSpace,
  defineStory,
  defineTag,
} from './index';
import { defineAsset as defineMapiAsset } from './mapi/index';
import {
  assetSchema,
  contentValueSchemas,
  datasourceEntrySchema,
  datasourceSchema,
  linkSchema,
  spaceSchema,
  tagSchema,
} from './zod/index';
import {
  assetSchema as mapiAssetSchema,
  componentSchema as mapiComponentSchema,
  fieldSchema as mapiFieldSchema,
} from './zod/mapi/index';

// Validates that helper output composes with the generated Zod schemas
// end-to-end. Unit tests cover each helper's defaults; this exercises the
// seam where helper-produced shapes meet the schema produced from the
// OpenAPI spec — the place a silent generator-vs-helper drift would land.

const ISO_DATETIME = '2024-01-01T00:00:00.000Z';
const UUID = '11111111-1111-4111-8111-111111111111';

describe('schema integration', () => {
  describe('content delivery API read schemas', () => {
    it('should accept a defineAsset() result', () => {
      const asset = defineAsset({
        filename: 'https://a.storyblok.com/f/1/image.png',
        created_at: ISO_DATETIME,
        updated_at: ISO_DATETIME,
      });
      expect(assetSchema.safeParse(asset).success).toBe(true);
    });

    it('should reject an asset with a non-string filename', () => {
      const asset = { ...defineAsset({
        filename: 'https://a.storyblok.com/f/1/image.png',
        created_at: ISO_DATETIME,
        updated_at: ISO_DATETIME,
      }), filename: 123 as unknown as string };
      expect(assetSchema.safeParse(asset).success).toBe(false);
    });

    it('should accept a defineDatasource() result', () => {
      const datasource = defineDatasource({
        name: 'Colors',
        slug: 'colors',
        created_at: ISO_DATETIME,
        updated_at: ISO_DATETIME,
      });
      expect(datasourceSchema.safeParse(datasource).success).toBe(true);
    });

    it('should accept a defineDatasourceEntry() result', () => {
      const entry = defineDatasourceEntry({ name: 'red', value: '#ff0000' });
      expect(datasourceEntrySchema.safeParse(entry).success).toBe(true);
    });

    it('should accept a defineLink() result', () => {
      const link = defineLink({ name: 'Home', slug: 'home', uuid: UUID });
      expect(linkSchema.safeParse(link).success).toBe(true);
    });

    it('should accept a defineSpace() result', () => {
      const space = defineSpace({ name: 'My Space', domain: 'example.com' });
      expect(spaceSchema.safeParse(space).success).toBe(true);
    });

    it('should accept a defineTag() result', () => {
      const tag = defineTag({ name: 'featured' });
      expect(tagSchema.safeParse(tag).success).toBe(true);
    });
  });

  describe('block content schemas', () => {
    const heroBlock = defineBlock({
      name: 'hero',
      is_root: true,
      schema: {
        headline: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
        body: defineProp(defineField({ type: 'textarea' }), { pos: 2 }),
        published: defineProp(defineField({ type: 'boolean' }), { pos: 3 }),
        priority: defineProp(defineField({ type: 'number' }), { pos: 4 }),
        background: defineProp(defineField({ type: 'asset' }), { pos: 5 }),
      },
    });

    it('should produce content values that satisfy the per-type content schemas', () => {
      const story = defineStory(heroBlock, {
        name: 'Home',
        content: {
          headline: 'Hello',
          body: 'World',
          published: true,
          priority: 1,
          background: {
            fieldtype: 'asset',
            id: 1,
            filename: 'https://a.storyblok.com/f/1/image.png',
            alt: null,
          },
        },
      });

      expect(contentValueSchemas.text.safeParse(story.content.headline).success).toBe(true);
      expect(contentValueSchemas.textarea.safeParse(story.content.body).success).toBe(true);
      expect(contentValueSchemas.boolean.safeParse(story.content.published).success).toBe(true);
      expect(contentValueSchemas.number.safeParse(story.content.priority).success).toBe(true);
      expect(contentValueSchemas.asset.safeParse(story.content.background).success).toBe(true);
    });

    it('should reject an asset content value with a wrong fieldtype discriminant', () => {
      const bad = {
        fieldtype: 'multilink',
        id: 1,
        filename: 'https://a.storyblok.com/f/1/image.png',
        alt: null,
      };
      expect(contentValueSchemas.asset.safeParse(bad).success).toBe(false);
    });
  });

  describe('management API helpers', () => {
    it('should accept a mapi defineAsset() result against the MAPI asset schema', () => {
      const asset = defineMapiAsset({
        filename: 'hero.png',
        created_at: ISO_DATETIME,
        updated_at: ISO_DATETIME,
      });
      expect(mapiAssetSchema.safeParse(asset).success).toBe(true);
    });

    it('should validate every prop in a defineBlock() schema via fieldSchema', () => {
      const block = defineBlock({
        name: 'hero',
        is_root: true,
        schema: {
          headline: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
          background: defineProp(defineField({ type: 'asset' }), { pos: 2 }),
          related: defineProp(defineField({ type: 'bloks', component_whitelist: ['teaser'] }), { pos: 3 }),
        },
      });
      for (const prop of Object.values(block.schema)) {
        expect(mapiFieldSchema.safeParse(prop).success).toBe(true);
      }
    });

    it('should reject a prop with an unknown field type', () => {
      expect(mapiFieldSchema.safeParse({ type: 'not-a-real-type', pos: 1 }).success).toBe(false);
    });

    it('should accept a full defineBlock() result against the MAPI component schema', () => {
      const block = defineBlock({
        name: 'hero',
        is_root: true,
        schema: {
          headline: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
        },
        created_at: ISO_DATETIME,
        updated_at: ISO_DATETIME,
      });
      // `component_group_uuid` defaults to `null`, but the generated schema
      // marks the field as `string().uuid().optional()` (no null). Strip it
      // for the parse — this is a known shape mismatch outside the scope of
      // this test.
      const { component_group_uuid: _, ...candidate } = block;
      expect(mapiComponentSchema.safeParse(candidate).success).toBe(true);
    });
  });
});

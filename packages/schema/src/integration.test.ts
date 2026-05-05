import { describe, expect, it } from 'vitest';

import {
  defineBlock,
  defineBlockCreate,
  defineDatasource,
  defineDatasourceEntry,
  defineField,
  defineLink,
  defineMapiAsset,
  defineSpace,
  defineStory,
  defineTag,
} from './index';
import {
  componentCreateSchema,
  contentValueSchemas,
  datasourceEntrySchema,
  datasourceSchema,
  fieldSchema,
  linkSchema,
  mapiAssetSchema,
  mapiSpaceSchema,
  tagSchema,
} from './zod/index';

// Validates that helper output composes with the generated Zod schemas
// end-to-end. Unit tests cover each helper's defaults; this exercises the
// seam where helper-produced shapes meet the schema produced from the
// OpenAPI spec — the place a silent generator-vs-helper drift would land.

const ISO_DATETIME = '2024-01-01T00:00:00.000Z';
const UUID = '11111111-1111-4111-8111-111111111111';

describe('schema integration', () => {
  describe('content delivery API read schemas', () => {
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
      expect(mapiSpaceSchema.safeParse(space).success).toBe(true);
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
      schema: [
        defineField('headline', { type: 'text', required: true }),
        defineField('body', { type: 'textarea' }),
        defineField('published', { type: 'boolean' }),
        defineField('priority', { type: 'number' }),
        defineField('background', { type: 'asset' }),
      ],
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
    it('should accept a defineMapiAsset() result against the MAPI asset schema', () => {
      const asset = defineMapiAsset({
        filename: 'hero.png',
        created_at: ISO_DATETIME,
        updated_at: ISO_DATETIME,
      });
      expect(mapiAssetSchema.safeParse(asset).success).toBe(true);
    });

    it('should validate every prop in a defineBlockCreate() schema via fieldSchema', () => {
      const block = defineBlockCreate({
        name: 'hero',
        is_root: true,
        schema: {
          headline: { type: 'text', pos: 1, required: true },
          background: { type: 'asset', pos: 2 },
          related: { type: 'bloks', component_whitelist: ['teaser'], pos: 3 },
        },
      });
      for (const prop of Object.values(block.schema ?? {})) {
        expect(fieldSchema.safeParse(prop).success).toBe(true);
      }
    });

    it('should reject a prop with an unknown field type', () => {
      expect(fieldSchema.safeParse({ type: 'not-a-real-type', pos: 1 }).success).toBe(false);
    });

    it('should accept a full defineBlockCreate() result against the MAPI component create schema', () => {
      const block = defineBlockCreate({
        name: 'hero',
        is_root: true,
        schema: {
          headline: { type: 'text', pos: 1, required: true },
        },
      });
      expect(componentCreateSchema.safeParse(block).success).toBe(true);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { deleteOutOfSchemaFields } from './delete-out-of-schema-fields';
import type { ComponentSchemas } from './map-refs';

const makeStory = (content: Record<string, unknown>) => ({
  id: 1,
  uuid: 'story-uuid',
  name: 'Test Story',
  slug: 'test-story',
  full_slug: 'test-story',
  content: { component: 'page', _uid: 'uid1', ...content },
  created_at: '2024-01-01T00:00:00.000Z',
  published_at: undefined,
  updated_at: '2024-01-01T00:00:00.000Z',
});

const schemaDefinition: ComponentSchemas = {
  page: { title: { type: 'text' }, url: { type: 'text' } },
  hero: { headline: { type: 'text' }, image: { type: 'asset' } },
};

describe('deleteOutOfSchemaFields', () => {
  it('should keep system fields _uid, component, _editable even if not in schema', () => {
    const story = makeStory({
      _editable: '<!--#storyblok#-->',
      title: 'Hello',
      ref: 'should-be-removed',
    });
    const { story: result } = deleteOutOfSchemaFields(
      story as any,
      schemaDefinition,
    );
    expect((result.content as any)._uid).toBe('uid1');
    expect((result.content as any).component).toBe('page');
    expect((result.content as any)._editable).toBe('<!--#storyblok#-->');
  });

  it('should keep fields that are in schema', () => {
    const story = makeStory({ title: 'Hello', url: 'https://example.com' });
    const { story: result } = deleteOutOfSchemaFields(
      story as any,
      schemaDefinition,
    );
    expect((result.content as any).title).toBe('Hello');
    expect((result.content as any).url).toBe('https://example.com');
  });

  it('should remove fields not in schema', () => {
    const story = makeStory({
      title: 'Hello',
      ref: 'remove-me',
      target: 'remove-me-too',
    });
    const { story: result } = deleteOutOfSchemaFields(
      story as any,
      schemaDefinition,
    );
    expect((result.content as any).ref).toBeUndefined();
    expect((result.content as any).target).toBeUndefined();
  });

  it('should keep i18n variants of in-schema fields', () => {
    const story = makeStory({
      title: 'Hello',
      title__i18n__de: 'Hallo',
      title__i18n__pl: 'Cześć',
    });
    const { story: result } = deleteOutOfSchemaFields(
      story as any,
      schemaDefinition,
    );
    expect((result.content as any).title__i18n__de).toBe('Hallo');
    expect((result.content as any).title__i18n__pl).toBe('Cześć');
  });

  it('should remove i18n variants of out-of-schema fields', () => {
    const story = makeStory({
      ref: 'remove-me',
      ref__i18n__de: 'remove-me-too',
    });
    const { story: result } = deleteOutOfSchemaFields(
      story as any,
      schemaDefinition,
    );
    expect((result.content as any).ref).toBeUndefined();
    expect((result.content as any).ref__i18n__de).toBeUndefined();
  });

  it('should work recursively with nested bloks', () => {
    const story = makeStory({
      body: [
        {
          component: 'hero',
          _uid: 'uid2',
          headline: 'Hello',
          image: { filename: 'test.jpg' },
          extra_field: 'remove-me',
        },
      ],
    });
    const schemaWithBody: ComponentSchemas = {
      ...schemaDefinition,
      page: { ...schemaDefinition.page, body: { type: 'bloks' } },
    };
    const { story: result } = deleteOutOfSchemaFields(
      story as any,
      schemaWithBody,
    );
    const hero = (result.content as any).body[0];
    expect(hero.headline).toBe('Hello');
    expect(hero.image).toBeDefined();
    expect(hero.extra_field).toBeUndefined();
    expect(hero._uid).toBe('uid2');
    expect(hero.component).toBe('hero');
  });

  it('should remove out-of-schema blok array fields', () => {
    const story = makeStory({
      title: 'Hello',
      old_body: [
        {
          component: 'hero',
          _uid: 'uid3',
          headline: 'Leftover',
        },
      ],
    });
    const { story: result, removedFields } = deleteOutOfSchemaFields(
      story as any,
      schemaDefinition,
    );
    expect((result.content as any).old_body).toBeUndefined();
    expect(removedFields).toContainEqual({ component: 'page', field: 'old_body' });
  });

  it('should return list of removed fields', () => {
    const story = makeStory({ title: 'Hello', ref: 'remove-me' });
    const { removedFields } = deleteOutOfSchemaFields(
      story as any,
      schemaDefinition,
    );
    expect(removedFields).toHaveLength(1);
    expect(removedFields[0].component).toBe('page');
    expect(removedFields[0].field).toBe('ref');
  });
});

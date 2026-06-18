import { defineBlock, defineBlockCreate, defineBlockUpdate, defineField } from '@storyblok/schema';
import { type Component as ComponentMapi, createManagementApiClient } from '@storyblok/management-api-client';
import { describe, expectTypeOf, it } from 'vitest';

// Nestable block — not a root story type
const teaserComponent = defineBlock({
  name: 'teaser',
  schema: [
    defineField('text', { type: 'text' }),
    defineField('image', { type: 'asset' }),
  ],
});

// Root content type, not nestable
const _pageComponent = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: [
    defineField('headline', { type: 'text', required: true }),
    defineField('body', { type: 'richtext' }),
    defineField('teasers', { type: 'bloks', component_whitelist: [teaserComponent.name] }),
  ],
});

const CLIENT_CONFIG = { personalAccessToken: 'test-token', spaceId: 12345 };

describe('components.create body type compatibility', () => {
  it('should produce a defineBlockCreate result assignable to components.create body', () => {
    const createPayload = defineBlockCreate({
      name: 'article',
      schema: {
        title: { type: 'text', pos: 1 },
      },
    });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['components']['create']>[0]['body'];
    type ComponentCreateInput = NonNullable<CreateBody['component']>;

    expectTypeOf(createPayload).toExtend<ComponentCreateInput>();
  });

  it('should produce a defineBlockUpdate result assignable to components.update body', () => {
    const updatePayload = defineBlockUpdate({
      display_name: 'Article',
    });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['components']['update']>[1]['body'];
    type ComponentUpdateInput = NonNullable<UpdateBody['component']>;

    expectTypeOf(updatePayload).toExtend<ComponentUpdateInput>();
  });
});

describe('components.get response shape', () => {
  it('should return a Component from components.get matching the wire shape', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.components.get(123);

    if (result.data?.component) {
      // components.get() returns the wrapper Component (= Block), matching the wire shape
      expectTypeOf(result.data.component.id).toEqualTypeOf<ComponentMapi['id']>();
      expectTypeOf(result.data.component.name).toEqualTypeOf<ComponentMapi['name']>();
      expectTypeOf(result.data.component).toHaveProperty('schema');
    }
  });
});

describe('components.create body type rejection', () => {
  it('should reject a component create payload with wrong schema field type', () => {
    const createPayload = defineBlockCreate({
      name: 'article',
      schema: {
        // @ts-expect-error: schema value must be a field definition, not a string
        title: 'invalid',
      },
    });
    void createPayload;
  });
});

describe('defineBlock result used in .withTypes() interface', () => {
  interface StoryblokTypes {
    components: typeof _pageComponent | typeof teaserComponent;
  }

  it('should narrow story content to page or teaser after withTypes', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);

    if (result.data?.story) {
      // Only page is a root component (is_root: true); teaser is nestable-only
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page'>();
    }
  });

  it('should narrow bloks field on page to whitelisted teasers', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);

    if (result.data?.story) {
      const story = result.data.story;
      if (story.content.component === 'page') {
        if (story.content.teasers) {
          for (const teaser of story.content.teasers) {
            // teasers whitelists only the teaser component
            expectTypeOf(teaser.component).toEqualTypeOf<'teaser'>();
          }
        }
      }
    }
  });
});

import { defineBlock, defineField } from '@storyblok/schema';
import { type Component as ComponentMapi, createManagementApiClient } from '@storyblok/management-api-client';
import { describe, expectTypeOf, it } from 'vitest';

// Nestable block — not a root story type
const teaserComponent = defineBlock({
  name: 'teaser',
  fields: [
    defineField('text', { type: 'text' }),
    defineField('image', { type: 'asset' }),
  ],
});

// Root content type, not nestable
const _pageComponent = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    defineField('headline', { type: 'text', required: true }),
    defineField('body', { type: 'richtext' }),
    defineField('teasers', { type: 'bloks', allow: [teaserComponent.name] }),
  ],
});

const CLIENT_CONFIG = { personalAccessToken: 'test-token', spaceId: 12345 };

describe('components.get response shape', () => {
  it('should return the wire Component (a `schema` record) from components.get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.components.get(123);

    if (result.data?.component) {
      // components.get() returns the wire-shaped Component definition (a `schema`
      // record), not the DSL `fields` block.
      expectTypeOf(result.data.component.id).toEqualTypeOf<ComponentMapi['id']>();
      expectTypeOf(result.data.component.name).toEqualTypeOf<ComponentMapi['name']>();
      expectTypeOf(result.data.component).toHaveProperty('schema');
    }
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

import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock, defineBlockCreate, defineBlockUpdate, defineField } from '@storyblok/schema';
import { createManagementApiClient } from '../index';
import type { Component as ComponentMapi } from '../generated/components/types.gen';

// ─── Component definitions using defineX helpers ─────────────────────────────

const teaserComponent = defineBlock({
  name: 'teaser',
  schema: [
    defineField('text', { type: 'text' }),
    defineField('image', { type: 'asset' }),
  ],
});

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

// ─── defineBlockCreate / defineBlockUpdate body compatibility ─────────────────

describe('components.create body type compatibility', () => {
  it('should produce a defineBlockCreate result assignable to components.create body', () => {
    const createPayload = defineBlockCreate({
      name: 'article',
      schema: {
        title: { type: 'text', pos: 1 },
      },
    });

    // The create body expects `component?: ComponentCreate`
    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['components']['create']>[0]['body'];
    type ComponentCreateInput = NonNullable<CreateBody['component']>;

    // defineBlockCreate returns ComponentCreate — must be assignable
    expectTypeOf(createPayload).toExtend<ComponentCreateInput>();
  });

  it('should produce a defineBlockUpdate result assignable to components.update body', () => {
    const updatePayload = defineBlockUpdate({
      display_name: 'Article',
    });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['components']['update']>[1]['body'];
    type ComponentUpdateInput = NonNullable<UpdateBody['component']>;

    // defineBlockUpdate returns ComponentUpdate — must be assignable
    expectTypeOf(updatePayload).toExtend<ComponentUpdateInput>();
  });
});

// ─── components.get response shape ─────────────────────────────────

describe('components.get response shape', () => {
  it('should return a Component from components.get matching the wire shape', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.components.get(123);

    if (result.data?.component) {
      expectTypeOf(result.data.component).toExtend<ComponentMapi>();
    }
  });
});

// ─── Negative type tests ─────────────────────────────────────────────────────

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

// ─── defineBlock output used in .withTypes() ─────────────────────────────────

describe('defineBlock result used in .withTypes() interface', () => {
  interface StoryblokTypes {
    components: typeof _pageComponent | typeof teaserComponent;
  }

  it('should narrow story content to page or teaser after withTypes', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);

    if (result.data?.story) {
      // Only root components (page) appear as story content — teaser is nestable-only
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
            expectTypeOf(teaser.component).toEqualTypeOf<'teaser'>();
          }
        }
      }
    }
  });
});

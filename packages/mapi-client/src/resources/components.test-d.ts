import { describe, expectTypeOf, it } from 'vitest';
import { defineField, defineProp } from '@storyblok/schema';
import {
  defineBlock,
  defineBlockCreate,
  defineBlockUpdate,
} from '@storyblok/schema/mapi';
import { createManagementApiClient } from '../index';
import type { Component as ComponentMapi } from '../generated/components/types.gen';

// ─── Component definitions using defineX helpers ─────────────────────────────

const teaserComponent = defineBlock({
  name: 'teaser',
  schema: {
    text: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    image: defineProp(defineField({ type: 'asset' }), { pos: 2 }),
  },
});

const _pageComponent = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    headline: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
    body: defineProp(defineField({ type: 'richtext' }), { pos: 2 }),
    teasers: defineProp(
      defineField({ type: 'bloks', component_whitelist: [teaserComponent.name] }),
      { pos: 3 },
    ),
  },
});

const CLIENT_CONFIG = { personalAccessToken: 'test-token', spaceId: 12345 };

// ─── defineBlockCreate / defineBlockUpdate body compatibility ─────────────────

describe('components.create body type compatibility', () => {
  it('should produce a defineBlockCreate result assignable to components.create body', () => {
    const createPayload = defineBlockCreate({
      name: 'article',
      schema: {
        title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
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

// ─── components.get response → defineBlock input compatibility ────────────────

describe('components.get response used as defineBlock input', () => {
  it('should return a component from components.get assignable to defineBlock input', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.components.get(123);

    if (result.data?.component) {
      // The component returned from the API is a full Component object.
      // defineBlock accepts it as input (optional fields like id/created_at/updated_at are already present).
      const apiComponent = result.data.component;
      // Component from API has same shape as what defineBlock returns
      expectTypeOf(apiComponent).toExtend<ComponentMapi>();

      // We can pass it directly to defineBlock — it satisfies the BlockInput constraint
      // (all required fields are present, optional fields like is_root/is_nestable default safely)
      const defined = defineBlock(apiComponent);
      expectTypeOf(defined.name).toBeString();
    }
  });

  it('should return components from components.list assignable to defineBlock input', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.components.list();

    if (result.data?.components) {
      for (const component of result.data.components) {
        const defined = defineBlock(component);
        expectTypeOf(defined.name).toBeString();
        expectTypeOf(defined.is_root).toEqualTypeOf<boolean>();
        expectTypeOf(defined.is_nestable).toEqualTypeOf<boolean>();
      }
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

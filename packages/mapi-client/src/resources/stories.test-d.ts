import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { defineStoryCreate, defineStoryUpdate } from '@storyblok/schema/mapi';
import { createManagementApiClient } from '../index';
import type { StoryMapi } from '../generated/stories/types.gen';

const teaserComponent = defineBlock({
  name: 'teaser',
  schema: {
    text: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    image: defineProp(defineField({ type: 'asset' }), { pos: 2 }),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});

const heroComponent = defineBlock({
  name: 'hero',
  is_root: true,
  // is_nestable defaults to true — hero can appear both as a story and in bloks
  schema: {
    title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    count: defineProp(defineField({ type: 'number' }), { pos: 2 }),
    // bloks field without a whitelist — resolves to nestable components (hero + teaser; page excluded)
    sections: defineProp(defineField({ type: 'bloks' }), { pos: 3 }),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});

const _pageComponent = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    body: defineProp(defineField({ type: 'richtext' }), { pos: 2 }),
    teasers: defineProp(
      defineField({ type: 'bloks', component_whitelist: [teaserComponent.name] }),
      { pos: 3 },
    ),
    hero: defineProp(
      defineField({ type: 'bloks', component_whitelist: [heroComponent.name] }),
      { pos: 4 },
    ),
    blocks: defineProp(
      defineField({ type: 'bloks', component_whitelist: [heroComponent.name, teaserComponent.name] }),
      { pos: 5 },
    ),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});

const CLIENT_CONFIG = { personalAccessToken: 'test-token', spaceId: 12345 };

interface StoryblokTypes {
  components: typeof _pageComponent | typeof heroComponent | typeof teaserComponent;
}

describe('createManagementApiClient without .withTypes()', () => {
  it('should return StoryMapi from stories.get()', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.stories.get(123);
    if (result.data) {
      expectTypeOf(result.data.story).toEqualTypeOf<StoryMapi | undefined>();
    }
  });

  it('should return StoryMapi array from stories.list()', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.stories.list();
    if (result.data) {
      expectTypeOf(result.data.stories).toEqualTypeOf<StoryMapi[] | undefined>();
    }
  });

  it('should infer ThrowOnError from config without .withTypes()', async () => {
    const client = createManagementApiClient({ ...CLIENT_CONFIG, throwOnError: true });
    const result = await client.stories.get(123);
    // ThrowOnError=true means data is always defined (no optional chaining needed)
    expectTypeOf(result.data.story).toEqualTypeOf<StoryMapi | undefined>();
  });

  it('should allow per-call throwOnError override to false', async () => {
    const client = createManagementApiClient({ ...CLIENT_CONFIG, throwOnError: true });
    const result = await client.stories.get(123, { throwOnError: false });
    if (result.data) {
      expectTypeOf(result.data.story).toEqualTypeOf<StoryMapi | undefined>();
    }
  });
});

describe('createManagementApiClient with .withTypes()', () => {
  it('should narrow page content fields after component discriminant check on get()', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);
    if (result.data?.story) {
      const story = result.data.story;
      if (story.content.component === 'page') {
        // Fields without `required: true` are optional and nullable
        expectTypeOf(story.content.headline).toEqualTypeOf<string | null | undefined>();
        expectTypeOf(story.content.component).toEqualTypeOf<'page'>();
      }
    }
  });

  it('should narrow hero content fields after component discriminant check on get()', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);
    if (result.data?.story) {
      const story = result.data.story;
      if (story.content.component === 'hero') {
        // Fields without `required: true` are optional and nullable
        expectTypeOf(story.content.title).toEqualTypeOf<string | null | undefined>();
        expectTypeOf(story.content.count).toEqualTypeOf<number | null | undefined>();
        expectTypeOf(story.content.component).toEqualTypeOf<'hero'>();
      }
    }
  });

  it('should have union of literal component names on content', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);
    if (result.data?.story) {
      // Only root components (page, hero) appear as story content — teaser is nestable-only
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page' | 'hero'>();
    }
  });

  it('should narrow discriminated union in stories.list()', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.list();
    if (result.data?.stories) {
      for (const story of result.data.stories) {
        if (story.content.component === 'page') {
          expectTypeOf(story.content.headline).toEqualTypeOf<string | null | undefined>();
        }
        if (story.content.component === 'hero') {
          expectTypeOf(story.content.count).toEqualTypeOf<number | null | undefined>();
        }
      }
    }
  });

  it('should narrow bloks field on page to whitelisted component names', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);
    if (result.data?.story) {
      const story = result.data.story;
      if (story.content.component === 'page') {
        // Bloks fields without `required: true` are optional and nullable — guard before iterating
        if (story.content.teasers) {
          for (const teaser of story.content.teasers) {
            expectTypeOf(teaser.component).toEqualTypeOf<'teaser'>();
            // Nested fields are also optional/nullable
            expectTypeOf(teaser.text).toEqualTypeOf<string | null | undefined>();
          }
        }
        if (story.content.hero) {
          for (const hero of story.content.hero) {
            expectTypeOf(hero.component).toEqualTypeOf<'hero'>();
            expectTypeOf(hero.count).toEqualTypeOf<number | null | undefined>();
          }
        }
        if (story.content.blocks) {
          for (const blok of story.content.blocks) {
            expectTypeOf(blok.component).toEqualTypeOf<'hero' | 'teaser'>();
          }
        }
      }
    }
  });

  it('should fall back to all schema components for bloks field without whitelist', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);
    if (result.data?.story) {
      const story = result.data.story;
      if (story.content.component === 'hero' && story.content.sections) {
        // sections has no component_whitelist — falls back to nestable components (hero + teaser; page is not nestable)
        type Sections = typeof story.content.sections;
        expectTypeOf<Sections[number]['component']>().toEqualTypeOf<'hero' | 'teaser'>();
      }
    }
  });

  it('should infer ThrowOnError alongside .withTypes()', async () => {
    const client = createManagementApiClient({ ...CLIENT_CONFIG, throwOnError: true }).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);
    // ThrowOnError=true means data is always defined (no optional chaining needed)
    if (result.data.story) {
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page' | 'hero'>();
    }
  });

  it('should allow per-call throwOnError override to false alongside .withTypes()', async () => {
    const client = createManagementApiClient({ ...CLIENT_CONFIG, throwOnError: true }).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123, { throwOnError: false });
    if (result.data?.story) {
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page' | 'hero'>();
    }
  });

  it('should narrow story in create() response', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.create({
      body: { story: { name: 'My Page', content: { component: 'page' } } },
    });
    if (result.data?.story) {
      const story = result.data.story;
      if (story.content.component === 'page') {
        expectTypeOf(story.content.headline).toEqualTypeOf<string | null | undefined>();
      }
    }
  });

  it('should narrow story in update() response', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.update(123, {
      body: { story: { content: { component: 'hero' } } },
    });
    if (result.data?.story) {
      const story = result.data.story;
      if (story.content.component === 'hero') {
        expectTypeOf(story.content.title).toEqualTypeOf<string | null | undefined>();
      }
    }
  });

  it('should narrow create() body story.content to component union', async () => {
    const _client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    // The body type should accept any component content from the schema
    type CreateBodyType = Parameters<typeof _client.stories.create>[0]['body'];
    type CreateStoryContent = NonNullable<CreateBodyType['story']['content']>;
    // Only root components (page, hero) can be created as stories
    expectTypeOf<CreateStoryContent['component']>().toEqualTypeOf<'page' | 'hero'>();
  });

  it('should narrow update() body story.content to component union', async () => {
    const _client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    type UpdateBodyType = Parameters<typeof _client.stories.update>[1]['body'];
    type UpdateStoryContent = NonNullable<UpdateBodyType['story']['content']>;
    // Only root components (page, hero) can be updated as stories
    expectTypeOf<UpdateStoryContent['component']>().toEqualTypeOf<'page' | 'hero'>();
  });
});

describe('defineStoryCreate / defineStoryUpdate combined with mapi client', () => {
  it('should produce a defineStoryCreate result accepted by untyped stories.create', async () => {
    const createPayload = defineStoryCreate(_pageComponent, {
      name: 'My Page',
      content: { headline: 'Hello' },
    });

    // Direct defineStoryCreate (no withTypes) pairs with the untyped client
    const client = createManagementApiClient(CLIENT_CONFIG);
    await client.stories.create({ body: { story: createPayload } });
  });

  it('should produce a defineStoryUpdate result accepted by untyped stories.update', async () => {
    const updatePayload = defineStoryUpdate(_pageComponent, {
      content: { headline: 'Updated' },
    });

    const client = createManagementApiClient(CLIENT_CONFIG);
    await client.stories.update(1, { body: { story: updatePayload } });
  });

  it('should produce a defineStoryCreate result for hero component accepted by untyped stories.create', async () => {
    const createPayload = defineStoryCreate(heroComponent, {
      name: 'My Hero',
      content: { title: 'Welcome', count: 42, sections: [] },
    });

    const client = createManagementApiClient(CLIENT_CONFIG);
    await client.stories.create({ body: { story: createPayload } });
  });

  it('should reject nestable-only component name in create body content', () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    client.stories.create({
      // @ts-expect-error: teaser is nestable-only, not a root component
      body: { story: { name: 'Bad', content: { component: 'teaser' } } },
    });
  });

  it('should reject wrong field value type in create body content', () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    client.stories.create({
      body: { story: { name: 'Bad', content: {
        component: 'page',
        // @ts-expect-error: headline must be string, not number
        headline: 123,
      } } },
    });
  });

  it('should return a typed story with content.component as discriminant from stories.get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);

    if (result.data?.story) {
      const story = result.data.story;
      // The story returned from the API has a discriminated content union
      expectTypeOf(story.content.component).toEqualTypeOf<'page' | 'hero'>();

      // Narrowing: use the story content as the basis for an update payload
      if (story.content.component === 'page') {
        // We can use the existing content in defineStoryUpdate to patch a field
        const updatePayload = defineStoryUpdate(_pageComponent, {
          name: story.name,
          content: { headline: story.content.headline ?? 'Default' },
        });
        // The update payload content has the narrowed component type
        expectTypeOf(updatePayload).toMatchTypeOf<{ name?: string | null }>();
      }
    }
  });
});

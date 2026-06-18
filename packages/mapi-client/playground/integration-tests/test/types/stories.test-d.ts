import { defineBlock, defineField, defineStoryCreate, defineStoryUpdate } from '@storyblok/schema';
import { createManagementApiClient, type Story as StoryMapi } from '@storyblok/management-api-client';
import { describe, expectTypeOf, it } from 'vitest';

// Nestable block — not a root story type
const teaserComponent = defineBlock({
  name: 'teaser',
  schema: [
    defineField('text', { type: 'text' }),
    defineField('image', { type: 'asset' }),
  ],
  id: 0,
  created_at: '',
  updated_at: '',
});

// Root content type that is also nestable (can appear as both a story and inside bloks)
const heroComponent = defineBlock({
  name: 'hero',
  is_root: true,
  schema: [
    defineField('title', { type: 'text' }),
    defineField('count', { type: 'number' }),
    // bloks field without a whitelist — resolves to nestable components only
    defineField('sections', { type: 'bloks' }),
  ],
  id: 0,
  created_at: '',
  updated_at: '',
});

// Root content type, not nestable
const _pageComponent = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: [
    defineField('headline', { type: 'text' }),
    defineField('body', { type: 'richtext' }),
    defineField('teasers', { type: 'bloks', component_whitelist: [teaserComponent.name] }),
    defineField('hero', { type: 'bloks', component_whitelist: [heroComponent.name] }),
    defineField('blocks', { type: 'bloks', component_whitelist: [heroComponent.name, teaserComponent.name] }),
  ],
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
      // Only root components (is_root: true) appear in story content
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
        if (story.content.teasers) {
          for (const teaser of story.content.teasers) {
            expectTypeOf(teaser.component).toEqualTypeOf<'teaser'>();
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
            // blocks whitelists both hero and teaser → union of the two
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
        // sections has no component_whitelist — falls back to nestable (is_nestable: true)
        // components only; page has is_nestable: false, so it is excluded
        type Sections = typeof story.content.sections;
        expectTypeOf<Sections[number]['component']>().toEqualTypeOf<'hero' | 'teaser'>();
      }
    }
  });

  it('should infer ThrowOnError alongside .withTypes()', async () => {
    const client = createManagementApiClient({ ...CLIENT_CONFIG, throwOnError: true }).withTypes<StoryblokTypes>();
    const result = await client.stories.get(123);
    if (result.data.story) {
      // ThrowOnError=true keeps data defined; only root components appear in content
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
    type CreateBodyType = Parameters<typeof _client.stories.create>[0]['body'];
    type CreateStoryContent = NonNullable<CreateBodyType['story']['content']>;
    // The write payload's content discriminant is narrowed to root component names too
    expectTypeOf<CreateStoryContent['component']>().toEqualTypeOf<'page' | 'hero'>();
  });

  it('should narrow update() body story.content to component union', async () => {
    const _client = createManagementApiClient(CLIENT_CONFIG).withTypes<StoryblokTypes>();
    type UpdateBodyType = Parameters<typeof _client.stories.update>[1]['body'];
    type UpdateStoryContent = NonNullable<UpdateBodyType['story']['content']>;
    // update() is the second positional arg (id, body); content discriminant is the root union
    expectTypeOf<UpdateStoryContent['component']>().toEqualTypeOf<'page' | 'hero'>();
  });
});

describe('defineStoryCreate / defineStoryUpdate combined with mapi client', () => {
  it('should produce a defineStoryCreate result accepted by untyped stories.create', async () => {
    const createPayload = defineStoryCreate(_pageComponent, {
      name: 'My Page',
      content: { headline: 'Hello' },
    });

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
      expectTypeOf(story.content.component).toEqualTypeOf<'page' | 'hero'>();

      if (story.content.component === 'page') {
        const updatePayload = defineStoryUpdate(_pageComponent, {
          name: story.name,
          content: { headline: story.content.headline ?? 'Default' },
        });
        expectTypeOf(updatePayload).toMatchTypeOf<{ name?: string | null }>();
      }
    }
  });
});

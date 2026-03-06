import { describe, expectTypeOf, it } from 'vitest';
import { defineComponent, defineField, defineProp } from '@storyblok/schema';
import type { FieldTypeValueMap } from '@storyblok/schema';
import { createApiClient } from '../index';
import type { StoryCapi } from '../generated/stories';

const _teaserComponent = defineComponent({
  name: 'teaser',
  schema: {
    text: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    image: defineProp(defineField({ type: 'asset' }), { pos: 2 }),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});

const _heroComponent = defineComponent({
  name: 'hero',
  schema: {
    title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    count: defineProp(defineField({ type: 'number' }), { pos: 2 }),
    // bloks field without a whitelist — should remain StoryContentGenerated[]
    sections: defineProp(defineField({ type: 'bloks' }), { pos: 3 }),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});

const _pageComponent = defineComponent({
  name: 'page',
  schema: {
    headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    body: defineProp(defineField({ type: 'richtext' }), { pos: 2 }),
    teasers: defineProp(
      defineField({ type: 'bloks', component_whitelist: ['teaser'] }),
      { pos: 3 },
    ),
    hero: defineProp(
      defineField({ type: 'bloks', component_whitelist: ['hero'] }),
      { pos: 4 },
    ),
    blocks: defineProp(
      defineField({ type: 'bloks', component_whitelist: ['hero', 'teaser'] }),
      { pos: 5 },
    ),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});

type MySchema = typeof _pageComponent | typeof _heroComponent | typeof _teaserComponent;

describe('createApiClient without Schema generic', () => {
  it('should return StoryCapi from stories.get()', async () => {
    const client = createApiClient({ accessToken: 'test-token' });
    const result = await client.stories.get('home');
    if (result.data) {
      expectTypeOf(result.data.story).toEqualTypeOf<StoryCapi>();
    }
  });

  it('should return StoryCapi array from stories.getAll()', async () => {
    const client = createApiClient({ accessToken: 'test-token' });
    const result = await client.stories.getAll();
    if (result.data) {
      expectTypeOf(result.data.stories).toEqualTypeOf<StoryCapi[]>();
    }
  });
});

describe('createApiClient with Schema generic', () => {
  it('should narrow page content fields after component discriminant check', async () => {
    const client = createApiClient<MySchema>({ accessToken: 'test-token' });
    const result = await client.stories.get('home');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'page') {
        expectTypeOf(story.content.headline).toEqualTypeOf<string>();
        expectTypeOf(story.content.component).toEqualTypeOf<'page'>();
      }
    }
  });

  it('should narrow hero content fields after component discriminant check', async () => {
    const client = createApiClient<MySchema>({ accessToken: 'test-token' });
    const result = await client.stories.get('home');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'hero') {
        expectTypeOf(story.content.title).toEqualTypeOf<string>();
        expectTypeOf(story.content.count).toEqualTypeOf<number>();
        expectTypeOf(story.content.component).toEqualTypeOf<'hero'>();
      }
    }
  });

  it('should have union of literal component names on content', async () => {
    const client = createApiClient<MySchema>({ accessToken: 'test-token' });
    const result = await client.stories.get('home');
    if (result.data) {
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page' | 'hero' | 'teaser'>();
      if (result.data.story.content.component === 'hero') {
        expectTypeOf(result.data.story.content.title).toEqualTypeOf<string>();
      }
    }
  });

  it('should narrow discriminated union in stories.getAll()', async () => {
    const client = createApiClient<MySchema>({ accessToken: 'test-token' });
    const result = await client.stories.getAll();
    if (result.data) {
      for (const story of result.data.stories) {
        if (story.content.component === 'page') {
          expectTypeOf(story.content.headline).toEqualTypeOf<string>();
        }
        if (story.content.component === 'hero') {
          expectTypeOf(story.content.count).toEqualTypeOf<number>();
        }
      }
    }
  });

  it('should narrow bloks field on page to whitelisted component names', async () => {
    const client = createApiClient<MySchema>({ accessToken: 'test-token' });
    const result = await client.stories.get('home');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'page') {
        for (const teaser of story.content.teasers) {
          expectTypeOf(teaser.component).toEqualTypeOf<'teaser'>();
          expectTypeOf(teaser.text).toEqualTypeOf<string>();
        }
        for (const hero of story.content.hero) {
          expectTypeOf(hero.component).toEqualTypeOf<'hero'>();
          expectTypeOf(hero.count).toEqualTypeOf<number>();
        }
        for (const blok of story.content.blocks) {
          expectTypeOf(blok.component).toEqualTypeOf<'hero' | 'teaser'>();
        }
      }
    }
  });

  it('should keep bloks field as StoryContentGenerated[] when no whitelist is given', async () => {
    const client = createApiClient<MySchema>({ accessToken: 'test-token' });
    const result = await client.stories.get('home');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'hero') {
        // sections has no component_whitelist — falls back to the broad generated type
        expectTypeOf(story.content.sections).toEqualTypeOf<FieldTypeValueMap['bloks']>();
      }
    }
  });
});

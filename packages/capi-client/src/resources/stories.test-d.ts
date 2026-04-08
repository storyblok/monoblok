import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { createApiClient } from '../index';
import type { StoryCapi } from '../generated/stories';

// Nestable block — not a root story type
const _teaserComponent = defineBlock({
  name: 'teaser',
  schema: {
    text: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
    image: defineProp(defineField({ type: 'asset' }), { pos: 2 }),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});
// Root content type that is also nestable (can appear as both a story and inside bloks)
const _heroComponent = defineBlock({
  name: 'hero',
  is_root: true,
  schema: {
    title: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
    count: defineProp(defineField({ type: 'number' }), { pos: 2, required: true }),
    // bloks field without a whitelist — resolves to nestable components only
    sections: defineProp(defineField({ type: 'bloks' }), { pos: 3, required: true }),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});
// Root content type, not nestable
const _pageComponent = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    headline: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
    body: defineProp(defineField({ type: 'richtext' }), { pos: 2 }),
    teasers: defineProp(
      defineField({ type: 'bloks', component_whitelist: ['teaser'] }),
      { pos: 3, required: true },
    ),
    hero: defineProp(
      defineField({ type: 'bloks', component_whitelist: ['hero'] }),
      { pos: 4, required: true },
    ),
    blocks: defineProp(
      defineField({ type: 'bloks', component_whitelist: ['hero', 'teaser'] }),
      { pos: 5, required: true },
    ),
  },
  id: 0,
  created_at: '',
  updated_at: '',
});

interface StoryblokTypes {
  components: typeof _pageComponent | typeof _heroComponent | typeof _teaserComponent;
}

describe('createApiClient without .withTypes()', () => {
  it('should return StoryCapi from stories.get()', async () => {
    const client = createApiClient({ accessToken: 'test-token' });
    const result = await client.stories.get('home');
    if (result.data) {
      expectTypeOf(result.data.story).toEqualTypeOf<StoryCapi>();
    }
  });

  it('should return StoryCapi array from stories.list()', async () => {
    const client = createApiClient({ accessToken: 'test-token' });
    const result = await client.stories.list();
    if (result.data) {
      expectTypeOf(result.data.stories).toEqualTypeOf<StoryCapi[]>();
    }
  });

  it('should infer ThrowOnError from config without .withTypes()', async () => {
    const client = createApiClient({ accessToken: 'test-token', throwOnError: true });
    const result = await client.stories.get('home');
    // ThrowOnError=true means data is always defined (no optional chaining needed)
    expectTypeOf(result.data.story).toEqualTypeOf<StoryCapi>();
  });

  it('should allow per-call throwOnError override to false', async () => {
    const client = createApiClient({ accessToken: 'test-token', throwOnError: true });
    const result = await client.stories.get('home', { throwOnError: false });
    expectTypeOf(result.data).toMatchTypeOf<{ story: StoryCapi } | undefined>();
  });
});

describe('createApiClient with .withTypes()', () => {
  it('should narrow page content fields after component discriminant check', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
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
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
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

  it('should have union of root component names on content', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
    const result = await client.stories.get('home');
    if (result.data) {
      // Only root components (is_root: true) appear in story content
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page' | 'hero'>();
      if (result.data.story.content.component === 'hero') {
        expectTypeOf(result.data.story.content.title).toEqualTypeOf<string>();
      }
    }
  });

  it('should narrow discriminated union in stories.list()', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
    const result = await client.stories.list();
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
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
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

  it('should fall back to nestable-only components for bloks field without whitelist', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
    const result = await client.stories.get('home');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'hero') {
        // sections has no component_whitelist — falls back to nestable (is_nestable: true) components only
        // page has is_nestable: false, so it is excluded; hero and teaser default to is_nestable: true
        type HeroContent = typeof story.content;
        type Sections = HeroContent['sections'];
        expectTypeOf<Sections[number]['component']>().toEqualTypeOf<'hero' | 'teaser'>();
      }
    }
  });

  it('should infer ThrowOnError alongside .withTypes()', async () => {
    const client = createApiClient({ accessToken: 'test-token', throwOnError: true }).withTypes<StoryblokTypes>();
    const result = await client.stories.get('home');
    // ThrowOnError=true means data is always defined (no optional chaining needed)
    // Only root components (page, hero) appear in story content
    expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page' | 'hero'>();
  });

  it('should allow per-call throwOnError override to false alongside .withTypes()', async () => {
    const client = createApiClient({ accessToken: 'test-token', throwOnError: true }).withTypes<StoryblokTypes>();
    const result = await client.stories.get('home', { throwOnError: false });
    expectTypeOf(result.data).toMatchTypeOf<{ story: { content: { component: 'page' | 'hero' } } } | undefined>();
  });

  it('should return schema-typed stories when inlineRelations is true', async () => {
    const client = createApiClient({ accessToken: 'test-token', inlineRelations: true }).withTypes<StoryblokTypes>();
    const result = await client.stories.get('home');
    if (result.data) {
      // Schema types are returned even with inlineRelations — the best static approximation
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'page' | 'hero'>();
      if (result.data.story.content.component === 'page') {
        expectTypeOf(result.data.story.content.headline).toEqualTypeOf<string>();
      }
    }
  });
});

describe('createApiClient with .withTypes() — negative type tests', () => {
  it('should not allow accessing a field from a different component without narrowing', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
    const result = await client.stories.get('home');
    if (result.data) {
      // Without narrowing by component, hero-specific field `count` should not be accessible
      // @ts-expect-error: count does not exist on the union without narrowing to hero
      void result.data.story.content.count;
    }
  });

  it('should not allow accessing non-existent field after narrowing', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<StoryblokTypes>();
    const result = await client.stories.get('home');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'page') {
        // @ts-expect-error: `nonExistent` is not a field on the page component
        void story.content.nonExistent;
      }
    }
  });
});

describe('resolve_relations type narrowing', () => {
  // Both are root content types — they have their own story pages in Storyblok
  // and can be referenced via resolve_relations
  const _authorComponent = defineBlock({
    name: 'author',
    is_root: true,
    schema: {
      bio: defineProp(defineField({ type: 'text' }), { pos: 0, required: true }),
    },
  });
  const _articleComponent = defineBlock({
    name: 'article',
    is_root: true,
    schema: {
      title: defineProp(defineField({ type: 'text' }), { pos: 0, required: true }),
      // In Storyblok, this would be an option field with source: internal_stories.
      // At the schema level it's just a text/option field (string).
      // resolve_relations is what tells the client to inline it.
      author: defineProp(defineField({ type: 'option' }), { pos: 1, required: true }),
      category: defineProp(defineField({ type: 'option' }), { pos: 2, required: true }),
    },
  });

  interface RelationStoryblokTypes { components: typeof _authorComponent | typeof _articleComponent }

  it('should type resolved relation fields as story objects in get()', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    }).withTypes<RelationStoryblokTypes>();
    const result = await client.stories.get('my-article', {
      query: { resolve_relations: 'article.author' },
    });
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'article') {
        // author is resolved → should be a story object, not string
        const author = story.content.author;
        expectTypeOf(author).toHaveProperty('content');
        // category is NOT resolved → should remain string
        expectTypeOf(story.content.category).toBeString();
      }
    }
  });

  it('should type multiple resolved fields in get()', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    }).withTypes<RelationStoryblokTypes>();
    const result = await client.stories.get('my-article', {
      query: { resolve_relations: 'article.author,article.category' },
    });
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'article') {
        // Both author and category are resolved
        expectTypeOf(story.content.author).toHaveProperty('content');
        expectTypeOf(story.content.category).toHaveProperty('content');
        // title is NOT resolved → should remain string
        expectTypeOf(story.content.title).toBeString();
      }
    }
  });

  it('should type resolved relation fields as story objects in list()', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    }).withTypes<RelationStoryblokTypes>();
    const result = await client.stories.list({
      query: { resolve_relations: 'article.author' },
    });
    if (result.data) {
      for (const story of result.data.stories) {
        if (story.content.component === 'article') {
          expectTypeOf(story.content.author).toHaveProperty('content');
          expectTypeOf(story.content.category).toBeString();
        }
      }
    }
  });

  it('should keep original schema types when no resolve_relations is provided', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    }).withTypes<RelationStoryblokTypes>();
    const result = await client.stories.get('my-article');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'article') {
        // No resolve_relations → all fields keep their schema types
        expectTypeOf(story.content.author).toBeString();
        expectTypeOf(story.content.category).toBeString();
      }
    }
  });

  it('should allow narrowing resolved relation content by component', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    }).withTypes<RelationStoryblokTypes>();
    const result = await client.stories.get('my-article', {
      query: { resolve_relations: 'article.author' },
    });
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'article') {
        const author = story.content.author;
        // The resolved story is typed to the full schema union — narrow by component
        if (author.content.component === 'author') {
          expectTypeOf(author.content.bio).toBeString();
        }
      }
    }
  });
});

describe('defineBlock result from mapi shape used in capi withTypes', () => {
  // Simulate the full workflow: components are defined once and shared between
  // mapi (for write operations) and capi (for read operations).
  // These components mirror what you would receive from mapi.components.get() and
  // then pass to defineBlock() to enrich with types.

  const _productComponent = defineBlock({
    name: 'product',
    is_root: true,
    is_nestable: false,
    // Simulating fields that would come from a mapi.components.get() response
    id: 42,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    schema: {
      title: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
      price: defineProp(defineField({ type: 'number' }), { pos: 2, required: true }),
      tags: defineProp(defineField({ type: 'options' }), { pos: 3, required: true }),
      description: defineProp(defineField({ type: 'richtext' }), { pos: 4 }),
    },
  });

  const _featureComponent = defineBlock({
    name: 'feature',
    is_nestable: true,
    id: 43,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    schema: {
      label: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
    },
  });

  interface ProductTypes {
    components: typeof _productComponent | typeof _featureComponent;
  }

  it('mapi-shaped defineBlock result should narrow capi story content', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<ProductTypes>();
    const result = await client.stories.get('product-slug');
    if (result.data) {
      // Only product (is_root: true) appears as story content; feature is nestable-only
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<'product'>();
    }
  });

  it('mapi-shaped defineBlock with required fields should have correct capi field types', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<ProductTypes>();
    const result = await client.stories.get('product-slug');
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === 'product') {
        // required: true → no null/undefined in capi
        expectTypeOf(story.content.title).toEqualTypeOf<string>();
        expectTypeOf(story.content.price).toEqualTypeOf<number>();
      }
    }
  });

  it('capi stories.list with mapi-shaped components should type each story', async () => {
    const client = createApiClient({ accessToken: 'test-token' }).withTypes<ProductTypes>();
    const result = await client.stories.list();
    if (result.data) {
      for (const story of result.data.stories) {
        // product is the only root component
        expectTypeOf(story.content.component).toEqualTypeOf<'product'>();
      }
    }
  });
});

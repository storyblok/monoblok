import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock } from './define-block';
import { defineField } from './define-field';
import { defineProp } from './define-prop';
import { createStoryHelpers } from './create-story-helpers';
import type { Story } from './define-story';

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    headline: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
    count: defineProp(defineField({ type: 'number' }), { pos: 2 }),
  },
});

const _teaserBlock = defineBlock({
  name: 'teaser',
  schema: {
    text: defineProp(defineField({ type: 'text' }), { pos: 1 }),
  },
});

const heroBlock = defineBlock({
  name: 'hero',
  is_root: true,
  schema: {
    title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    blocks: defineProp(defineField({ type: 'bloks' }), { pos: 2, required: true }),
  },
});

interface StoryblokTypes {
  components: typeof pageBlock | typeof _teaserBlock | typeof heroBlock;
}

describe('createStoryHelpers', () => {
  it('should return an object with a withTypes method', () => {
    const helpers = createStoryHelpers();
    expectTypeOf(helpers.withTypes).toBeFunction();
  });

  it('should expose defineStory directly without withTypes', () => {
    const { defineStory } = createStoryHelpers();
    expectTypeOf(defineStory).toBeFunction();
  });

  it('should expose defineStory after calling withTypes', () => {
    const { defineStory } = createStoryHelpers().withTypes<StoryblokTypes>();
    expectTypeOf(defineStory).toBeFunction();
  });
});

describe('defineStory from createStoryHelpers().withTypes()', () => {
  const { defineStory } = createStoryHelpers().withTypes<StoryblokTypes>();

  it('should infer block content fields', () => {
    const story = defineStory(pageBlock, {
      name: 'Home',
      content: {
        headline: 'Hello',
        count: 42,
      },
    });

    expectTypeOf(story.content.component).toEqualTypeOf<'page'>();
    expectTypeOf(story.content.headline).toEqualTypeOf<string>();
    expectTypeOf(story.content.count).toEqualTypeOf<number | null | undefined>();
  });

  it('should return a Story type with metadata fields', () => {
    const story = defineStory(pageBlock, {
      name: 'Home',
      content: { headline: 'Hello' },
    });

    expectTypeOf(story).toExtend<{ id: number; slug: string }>();
  });

  it('should resolve nested bloks to the block union', () => {
    const _story = defineStory(heroBlock, {
      name: 'Hero',
      content: {
        title: 'Welcome',
        blocks: [{ component: 'teaser', text: 'hi' }],
      },
    });

    type Blocks = typeof _story.content.blocks;
    // blocks has no whitelist → nestable blocks (hero default nestable + teaser)
    expectTypeOf<Blocks[number]['component']>().toEqualTypeOf<'hero' | 'teaser'>();
  });

  it('should reject wrong value types in content', () => {
    defineStory(pageBlock, {
      name: 'Home',
      // @ts-expect-error: number is not assignable to string
      content: { headline: 42 },
    });
  });

  it('should return the correct Story generic type', () => {
    const story = defineStory(pageBlock, {
      name: 'Home',
      content: { headline: 'Hello' },
    });

    expectTypeOf(story).toExtend<Story<typeof pageBlock, StoryblokTypes['components']>>();
  });
});

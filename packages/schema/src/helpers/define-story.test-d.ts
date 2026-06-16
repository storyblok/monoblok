import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock } from './define-block';
import { defineField } from './define-field';
import { defineStory, type Story } from './define-story';

describe('defineStory type inference', () => {
  it('should constrain content to block schema types', () => {
    const block = defineBlock({
      name: 'page',
      is_root: true,
      fields: [
        defineField('headline', { type: 'text', required: true }),
        defineField('count', { type: 'number' }),
      ],
    });

    const story = defineStory(block, {
      name: 'Home',
      content: {
        headline: 'Hello',
        count: 42,
      },
    });

    expectTypeOf(story.content.component).toEqualTypeOf<'page'>();
    // required field
    expectTypeOf(story.content.headline).toEqualTypeOf<string>();
    // optional field
    expectTypeOf(story.content.count).toEqualTypeOf<number | null | undefined>();
  });

  it('should reject wrong value types in content', () => {
    const block = defineBlock({
      name: 'page',
      is_root: true,
      fields: [
        defineField('headline', { type: 'text' }),
      ],
    });

    defineStory(block, {
      name: 'Home',
      // @ts-expect-error: number is not assignable to string
      content: { headline: 42 },
    });
  });
});

const _pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    defineField('headline', { type: 'text', required: true }),
  ],
});

const _heroBlock = defineBlock({
  name: 'hero',
  is_root: true,
  fields: [
    defineField('title', { type: 'text' }),
    defineField('blocks', { type: 'bloks', required: true }),
  ],
});

const _teaserBlock = defineBlock({
  name: 'teaser',
  // nestable by default (is_root: false, is_nestable: true)
  fields: [
    defineField('text', { type: 'text' }),
  ],
});

type Schema = typeof _pageBlock | typeof _heroBlock | typeof _teaserBlock;

describe('Story<Schema> — single-generic mode', () => {
  it('should produce only root block stories', () => {
    type S = Story<Schema>;
    // content.component must be only the root blocks
    type Component = S['content']['component'];
    expectTypeOf<Component>().toEqualTypeOf<'page' | 'hero'>();
  });

  it('should exclude non-root blocks from story union', () => {
    type S = Story<Schema>;
    type HasTeaser = 'teaser' extends S['content']['component'] ? true : false;
    expectTypeOf<HasTeaser>().toEqualTypeOf<false>();
  });

  it('should carry metadata fields', () => {
    type S = Story<Schema>;
    expectTypeOf<S>().toExtend<{ id: number; slug: string }>();
  });
});

describe('Story<TBlock, TSchema> — two-generic mode', () => {
  it('should produce a single-block story', () => {
    type S = Story<typeof _pageBlock, Schema>;
    expectTypeOf<S['content']['component']>().toEqualTypeOf<'page'>();
    expectTypeOf<S['content']['headline']>().toEqualTypeOf<string>();
  });

  it('should preserve nested blok typing via TSchema', () => {
    type S = Story<typeof _heroBlock, Schema>;
    // blocks has no whitelist → resolves to nestable blocks only
    // hero (is_nestable: true default) and teaser (is_nestable: true default) are nestable;
    // page (is_nestable: false) is excluded
    type Blocks = S['content']['blocks'];
    expectTypeOf<Blocks[number]['component']>().toEqualTypeOf<'hero' | 'teaser'>();
  });
});

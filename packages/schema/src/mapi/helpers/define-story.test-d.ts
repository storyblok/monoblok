import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock } from '../../helpers/define-block';
import { defineField } from '../../helpers/define-field';
import { defineProp } from '../../helpers/define-prop';
import type { Story, StoryCreate, StoryUpdate } from './define-story';

const _pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    headline: defineProp(defineField({ type: 'text' }), { pos: 1, required: true }),
  },
});

const _heroBlock = defineBlock({
  name: 'hero',
  is_root: true,
  schema: {
    title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    blocks: defineProp(defineField({ type: 'bloks' }), { pos: 2, required: true }),
  },
});

const _teaserBlock = defineBlock({
  name: 'teaser',
  schema: {
    text: defineProp(defineField({ type: 'text' }), { pos: 1 }),
  },
});

const _sectionBlock = defineBlock({
  name: 'section',
  schema: {
    items: defineProp(
      defineField({ type: 'bloks', component_whitelist: ['teaser'] as const }),
      { pos: 1, required: true },
    ),
  },
});

type Schema = typeof _pageBlock | typeof _heroBlock | typeof _teaserBlock | typeof _sectionBlock;

describe('Story<Schema> — single-generic mode', () => {
  it('should produce only root block stories', () => {
    type S = Story<Schema>;
    type Component = S['content']['component'];
    expectTypeOf<Component>().toEqualTypeOf<'page' | 'hero'>();
  });

  it('should exclude non-root blocks from story union', () => {
    type S = Story<Schema>;
    type HasTeaser = 'teaser' extends S['content']['component'] ? true : false;
    expectTypeOf<HasTeaser>().toEqualTypeOf<false>();
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
    type Blocks = S['content']['blocks'];
    expectTypeOf<Blocks[number]['component']>().toEqualTypeOf<'hero' | 'teaser' | 'section'>();
  });
});

describe('Nested bloks — two-level deep', () => {
  it('should resolve bloks inside bloks via TSchema', () => {
    type S = Story<typeof _heroBlock, Schema>;
    // hero.blocks can be hero|teaser|section (all nestable)
    // Narrowing to section: section.items is a whitelisted bloks field → teaser[]
    type SectionBlok = Extract<S['content']['blocks'][number], { component: 'section' }>;
    type Items = SectionBlok['items'];
    expectTypeOf<Items[number]['component']>().toEqualTypeOf<'teaser'>();
  });
});

describe('StoryCreate<Schema> — single-generic mode', () => {
  it('should produce only root block create payloads', () => {
    type C = StoryCreate<Schema>;
    type ContentComponent = NonNullable<C['content']>['component'];
    expectTypeOf<ContentComponent>().toEqualTypeOf<'page' | 'hero'>();
  });
});

describe('StoryUpdate<Schema> — single-generic mode', () => {
  it('should produce only root block update payloads', () => {
    type U = StoryUpdate<Schema>;
    type ContentComponent = NonNullable<U['content']>['component'];
    expectTypeOf<ContentComponent>().toEqualTypeOf<'page' | 'hero'>();
  });
});

describe('Two-generic mode for create/update', () => {
  it('StoryCreate two-generic should narrow content to specific block', () => {
    type C = StoryCreate<typeof _pageBlock, Schema>;
    type ContentComponent = NonNullable<C['content']>['component'];
    expectTypeOf<ContentComponent>().toEqualTypeOf<'page'>();
  });
});

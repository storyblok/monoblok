import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock, type NestableBlocks, type RootBlocks } from './define-block';
import { defineField } from './define-field';
import { defineProp } from './define-prop';

describe('defineBlock', () => {
  it('should preserve literal name type', () => {
    const comp = defineBlock({
      name: 'hero',
      schema: {
        title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
      },
    });
    expectTypeOf(comp.name).toEqualTypeOf<'hero'>();
  });

  it('should preserve is_root: true literal', () => {
    const pageBlock = defineBlock({ name: 'page', is_root: true, schema: {} });
    expectTypeOf(pageBlock.is_root).toEqualTypeOf<true>();
  });

  it('should preserve is_nestable: false literal', () => {
    const pageBlock = defineBlock({ name: 'page', is_nestable: false, schema: {} });
    expectTypeOf(pageBlock.is_nestable).toEqualTypeOf<false>();
  });

  it('should default is_root to false when not provided', () => {
    const pageBlock = defineBlock({ name: 'page', schema: {} });
    expectTypeOf(pageBlock.is_root).toEqualTypeOf<false>();
  });

  it('should default is_nestable to true when not provided', () => {
    const pageBlock = defineBlock({ name: 'page', schema: {} });
    expectTypeOf(pageBlock.is_nestable).toEqualTypeOf<true>();
  });

  it('should default component_group_uuid to null when not provided', () => {
    const pageBlock = defineBlock({ name: 'page', schema: {} });
    expectTypeOf(pageBlock.component_group_uuid).toEqualTypeOf<null>();
  });

  it('should preserve explicit component_group_uuid literal', () => {
    const pageBlock = defineBlock({ name: 'page', component_group_uuid: 'shared-group', schema: {} });
    expectTypeOf(pageBlock.component_group_uuid).toEqualTypeOf<'shared-group'>();
  });
});

const schema = {
  title: defineProp(defineField({ type: 'text' }), { pos: 1 }),
};

const _pageBlock = defineBlock({ name: 'page', is_root: true, is_nestable: false, schema });
const _heroBlock = defineBlock({ name: 'hero', is_root: true, schema }); // nestable by default
const _teaserBlock = defineBlock({ name: 'teaser', schema }); // not root, nestable by default

type Schema = typeof _pageBlock | typeof _heroBlock | typeof _teaserBlock;

describe('RootBlocks', () => {
  it('should include only blocks with is_root: true', () => {
    type Roots = RootBlocks<Schema>;
    // page and hero have is_root: true
    expectTypeOf<Roots['name']>().toEqualTypeOf<'page' | 'hero'>();
  });

  it('should exclude blocks without is_root: true', () => {
    type Roots = RootBlocks<Schema>;
    // teaser defaults to is_root: false — must not appear
    type HasTeaser = 'teaser' extends Roots['name'] ? true : false;
    expectTypeOf<HasTeaser>().toEqualTypeOf<false>();
  });
});

describe('NestableBlocks', () => {
  it('should include only blocks with is_nestable: true', () => {
    type Nestable = NestableBlocks<Schema>;
    // hero and teaser are nestable; page has is_nestable: false
    expectTypeOf<Nestable['name']>().toEqualTypeOf<'hero' | 'teaser'>();
  });

  it('should exclude blocks with is_nestable: false', () => {
    type Nestable = NestableBlocks<Schema>;
    type HasPage = 'page' extends Nestable['name'] ? true : false;
    expectTypeOf<HasPage>().toEqualTypeOf<false>();
  });
});

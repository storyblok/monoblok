import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock, type NestableBlock, type RootBlock } from './define-block';
import { defineField } from './define-field';

describe('defineBlock', () => {
  it('should preserve literal name type', () => {
    const comp = defineBlock({
      name: 'hero',
      fields: [
        defineField('title', { type: 'text' }),
      ],
    });
    expectTypeOf(comp.name).toEqualTypeOf<'hero'>();
  });

  it('should preserve is_root: true literal', () => {
    const pageBlock = defineBlock({ name: 'page', is_root: true, fields: [] });
    expectTypeOf(pageBlock.is_root).toEqualTypeOf<true>();
  });

  it('should preserve is_nestable: false literal', () => {
    const pageBlock = defineBlock({ name: 'page', is_nestable: false, fields: [] });
    expectTypeOf(pageBlock.is_nestable).toEqualTypeOf<false>();
  });

  it('should default is_root to false when not provided', () => {
    const pageBlock = defineBlock({ name: 'page', fields: [] });
    expectTypeOf(pageBlock.is_root).toEqualTypeOf<false>();
  });

  it('should default is_nestable to true when not provided', () => {
    const pageBlock = defineBlock({ name: 'page', fields: [] });
    expectTypeOf(pageBlock.is_nestable).toEqualTypeOf<true>();
  });

  it('should default component_group_uuid to null when not provided', () => {
    const pageBlock = defineBlock({ name: 'page', fields: [] });
    expectTypeOf(pageBlock.component_group_uuid).toEqualTypeOf<null>();
  });

  it('should preserve explicit component_group_uuid literal', () => {
    const pageBlock = defineBlock({ name: 'page', component_group_uuid: 'shared-group', fields: [] });
    expectTypeOf(pageBlock.component_group_uuid).toEqualTypeOf<'shared-group'>();
  });

  it('should accept a string or null description', () => {
    const testBlock = defineBlock({ name: 'test', description: 'A test block', fields: [] });
    const nullDescriptionBlock = defineBlock({ name: 'test', description: null, fields: [] });
    expectTypeOf(testBlock.description).toEqualTypeOf<string | null | undefined>();
    expectTypeOf(nullDescriptionBlock.description).toEqualTypeOf<string | null | undefined>();
  });
});

const fields = [
  defineField('title', { type: 'text' }),
];

const _pageBlock = defineBlock({ name: 'page', is_root: true, is_nestable: false, fields });
const _heroBlock = defineBlock({ name: 'hero', is_root: true, fields }); // nestable by default
const _teaserBlock = defineBlock({ name: 'teaser', fields }); // not root, nestable by default

type Schema = typeof _pageBlock | typeof _heroBlock | typeof _teaserBlock;

describe('RootBlock', () => {
  it('should include only blocks with is_root: true', () => {
    type Roots = RootBlock<Schema>;
    // page and hero have is_root: true
    expectTypeOf<Roots['name']>().toEqualTypeOf<'page' | 'hero'>();
  });

  it('should exclude blocks without is_root: true', () => {
    type Roots = RootBlock<Schema>;
    // teaser defaults to is_root: false — must not appear
    type HasTeaser = 'teaser' extends Roots['name'] ? true : false;
    expectTypeOf<HasTeaser>().toEqualTypeOf<false>();
  });
});

describe('NestableBlock', () => {
  it('should include only blocks with is_nestable: true', () => {
    type Nestable = NestableBlock<Schema>;
    // hero and teaser are nestable; page has is_nestable: false
    expectTypeOf<Nestable['name']>().toEqualTypeOf<'hero' | 'teaser'>();
  });

  it('should exclude blocks with is_nestable: false', () => {
    type Nestable = NestableBlock<Schema>;
    type HasPage = 'page' extends Nestable['name'] ? true : false;
    expectTypeOf<HasPage>().toEqualTypeOf<false>();
  });
});

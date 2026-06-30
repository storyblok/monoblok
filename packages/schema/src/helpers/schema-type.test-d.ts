import { describe, expectTypeOf, it } from 'vitest';
import { defineBlock } from './define-block';
import { defineField } from './define-field';
import { defineDatasource } from './define-datasource';
import type { Schema } from './schema-type';

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    defineField('headline', { type: 'text' }),
  ],
});

const heroBlock = defineBlock({
  name: 'hero',
  fields: [
    defineField('title', { type: 'text' }),
  ],
});

const colorsDatasource = defineDatasource({ name: 'Colors', slug: 'colors' });

const _schema = {
  blocks: { pageBlock, heroBlock },
  datasources: { colorsDatasource },
};

const _schemaComponentsOnly = {
  blocks: { pageBlock, heroBlock },
};

type Types = Schema<typeof _schema>;
type TypesComponentsOnly = Schema<typeof _schemaComponentsOnly>;

describe('Schema', () => {
  it('produces a union of block types from a schema object', () => {
    expectTypeOf<Types['blocks']>().toEqualTypeOf<
      typeof pageBlock | typeof heroBlock
    >();
  });

  it('is assignable to StoryblokTypesConfig (blocks: Block)', () => {
    expectTypeOf<Types>().toMatchTypeOf<{ blocks: typeof pageBlock | typeof heroBlock }>();
  });

  it('extracts block names as string literals', () => {
    expectTypeOf<Types['blocks']['name']>().toEqualTypeOf<'page' | 'hero'>();
  });

  it('produces a union of datasource types', () => {
    expectTypeOf<Types['datasources']>().toEqualTypeOf<typeof colorsDatasource>();
  });

  it('datasources are never when not provided', () => {
    expectTypeOf<TypesComponentsOnly['datasources']>().toBeNever();
  });
});

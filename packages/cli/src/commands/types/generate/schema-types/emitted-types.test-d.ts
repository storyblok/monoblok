import { describe, expectTypeOf, it } from 'vitest';

import type { AnyBlock, Block, Blocks, Schema } from './__fixtures__/expected-types';

/**
 * Asserts the *behaviour* of the generated types, not their text. This is the
 * test that proves definition types plus `BlockContent` reproduce hand-written
 * schema types, the central claim of the design.
 */
describe('generated types', () => {
  it('resolves a block content type by name', () => {
    expectTypeOf<Block<'hero'>>().toMatchObjectType<{ component: 'hero' }>();
  });

  it('makes required fields required and others optional', () => {
    expectTypeOf<Block<'hero'>>().toHaveProperty('headline').toEqualTypeOf<string>();
    expectTypeOf<Block<'hero'>>().toHaveProperty('image').toBeNullable();
  });

  it('drops tab fields to a non-value type', () => {
    expectTypeOf<Block<'hero'>>().toHaveProperty('general').toBeNullable();
  });

  it('narrows a whitelisted bloks field to the allowed block only', () => {
    type Nested = NonNullable<Block<'hero'>['nested']>;
    // `Nested[number]` is a union that distributes over `component`, so the
    // union's discriminant is checked directly rather than through
    // `toMatchObjectType`, which does not support union-typed `Actual` values.
    expectTypeOf<Nested[number]['component']>().toEqualTypeOf<'grid'>();
  });

  it('supports recursive blocks', () => {
    type Columns = NonNullable<Block<'grid'>['columns']>;
    // `grid` nests itself: a `grid`-component member must exist in the union.
    expectTypeOf<Extract<Columns[number], { component: 'grid' }>>().not.toBeNever();
  });

  it('excludes non-nestable blocks from bloks unions', () => {
    type Columns = NonNullable<Block<'grid'>['columns']>;
    // `page` is is_nestable: false, so it must not appear
    expectTypeOf<Columns[number]['component']>().not.toEqualTypeOf<'page'>();
    expectTypeOf<Columns[number]['component']>().toEqualTypeOf<'grid' | 'hero'>();
  });

  it('exposes a Schema shaped for withTypes<Schema>()', () => {
    expectTypeOf<Schema>().toMatchObjectType<{ blocks: Blocks }>();
  });

  it('accepts any block through AnyBlock', () => {
    expectTypeOf<AnyBlock>().toHaveProperty('component');
  });
});

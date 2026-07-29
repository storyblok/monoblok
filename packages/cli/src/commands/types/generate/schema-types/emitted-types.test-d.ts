import type { Block as SchemaBlock } from '@storyblok/schema';
import { describe, expectTypeOf, it } from 'vitest';

import type { AnyBlock, Block, Blocks, Schema } from './__fixtures__/expected-types';
import type { Block as PluginBlock, Story as PluginStory } from './__fixtures__/expected-types-with-plugins';

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

  it('resolves tab fields to an absent, valueless property', () => {
    expectTypeOf<Block<'hero'>>().toHaveProperty('general').toEqualTypeOf<null | undefined>();
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
    // `page` has is_nestable: false, so it must not appear; this is exact
    // equality against the full expected union, so a stray `'page'` member
    // fails it (a `not.toEqualTypeOf<'page'>()` check would not: it is
    // structurally incapable of failing against a multi-member union).
    expectTypeOf<Columns[number]['component']>().toEqualTypeOf<'grid' | 'hero'>();
  });

  it('exposes a Schema shaped for withTypes<Schema>()', () => {
    expectTypeOf<Schema>().toMatchObjectType<{ blocks: Blocks }>();
  });

  it('emits Blocks that satisfy withTypes\'s StoryblokTypesConfig constraint', () => {
    // `createApiClient(...).withTypes<T>()` accepts `{ components: Block } | { blocks: Block }`
    // (`packages/capi-client/src/client.ts`), so the emitted union must extend `Block`.
    expectTypeOf<Blocks>().toExtend<SchemaBlock>();
  });

  it('accepts any block through AnyBlock', () => {
    // The discriminant must be the full union of component names, not a
    // single block's, so this fails if `AnyBlock` is ever wrongly narrowed to
    // one block (a plain `toHaveProperty('component')` would not catch that).
    expectTypeOf<AnyBlock['component']>().toEqualTypeOf<'hero' | 'grid' | 'page'>();
  });
});

/**
 * Renders `__fixtures__/components.ts` again with `__fixtures__/plugins.ts`
 * registered (see `fixture-drift.test.ts`, "matches what the renderer
 * produces with field plugins registered"). Every fixture above this point
 * uses `fieldPlugins: { kind: 'none' }`, under which `FieldPlugins` is
 * `Record<never, never>` and `InferStory<Blocks>` and
 * `InferStory<Blocks, FieldPlugins>` are indistinguishable. This block is the
 * only one that can catch `render.ts` regressing to the single-argument form.
 */
describe('emitted Story/StoryMapi thread FieldPlugins', () => {
  it('resolves a registered custom field through Block<TName>', () => {
    expectTypeOf<NonNullable<PluginBlock<'page'>['accent']>>().toHaveProperty('hex').toEqualTypeOf<string>();
  });

  it('resolves a registered custom field through Story, not just through Block<TName>', () => {
    expectTypeOf<NonNullable<PluginStory['content']['accent']>>().toHaveProperty('hex').toEqualTypeOf<string>();
  });
});

import type { Block } from './define-block';
import {
  defineMapiStory as defineMapiStoryImpl,
  defineStoryCreate as defineStoryCreateImpl,
  defineStory as defineStoryImpl,
  defineStoryUpdate as defineStoryUpdateImpl,
} from './define-story';
import type { MapiStory, Story, StoryComponent, StoryCreate, StoryUpdate } from './define-story';

type StoryblokTypesConfig = { components: Block } | { blocks: Block };

type ResolveComponents<T extends StoryblokTypesConfig> =
  T extends { components: infer C extends Block } ? C
    : T extends { blocks: infer B extends Block } ? B
      : never;

type DefineStoryTyped<TBlocks extends Block> =
  <const TBlock extends StoryComponent>(
    component: TBlock,
    story: Parameters<typeof defineStoryImpl<TBlock, TBlocks>>[1],
  ) => Story<TBlock, TBlocks>;

type DefineMapiStoryTyped<TBlocks extends Block> =
  <const TBlock extends StoryComponent>(
    component: TBlock,
    story: Parameters<typeof defineMapiStoryImpl<TBlock, TBlocks>>[1],
  ) => MapiStory<TBlock, TBlocks>;

type DefineStoryCreateTyped<TBlocks extends Block> =
  <const TBlock extends StoryComponent>(
    component: TBlock,
    story: Parameters<typeof defineStoryCreateImpl<TBlock, TBlocks>>[1],
  ) => StoryCreate<TBlock, TBlocks>;

type DefineStoryUpdateTyped<TBlocks extends Block> =
  <const TBlock extends StoryComponent>(
    component: TBlock,
    story: Parameters<typeof defineStoryUpdateImpl<TBlock, TBlocks>>[1],
  ) => StoryUpdate<TBlock, TBlocks>;

/**
 * Creates story helper functions pre-bound to your component type union.
 *
 * `withTypes<T>()` accepts either `{ components: ... }` or `{ blocks: ... }` — the
 * latter matches the `Schema` type produced by `InferSchema`, so a project's
 * `Schema` can be passed directly without an extra wrapper.
 *
 * @example
 * ```ts
 * import type { Schema } from './schema';
 *
 * const { defineStory, defineMapiStory, defineStoryCreate, defineStoryUpdate } =
 *   createStoryHelpers().withTypes<Schema>();
 * ```
 */
export function createStoryHelpers() {
  return {
    defineStory: defineStoryImpl,
    defineMapiStory: defineMapiStoryImpl,
    defineStoryCreate: defineStoryCreateImpl,
    defineStoryUpdate: defineStoryUpdateImpl,
    withTypes<T extends StoryblokTypesConfig>() {
      const defineStory: DefineStoryTyped<ResolveComponents<T>> = (component, story) =>
        defineStoryImpl(component, story as any);

      const defineMapiStory: DefineMapiStoryTyped<ResolveComponents<T>> = (component, story) =>
        defineMapiStoryImpl(component, story as any);

      const defineStoryCreate: DefineStoryCreateTyped<ResolveComponents<T>> = (component, story) =>
        defineStoryCreateImpl(component, story as any);

      const defineStoryUpdate: DefineStoryUpdateTyped<ResolveComponents<T>> = (component, story) =>
        defineStoryUpdateImpl(component, story as any);

      return { defineStory, defineMapiStory, defineStoryCreate, defineStoryUpdate };
    },
  };
}

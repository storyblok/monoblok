import type { Block } from './define-block';
import {
  defineMapiStory as defineMapiStoryImpl,
  defineStoryCreate as defineStoryCreateImpl,
  defineStory as defineStoryImpl,
  defineStoryUpdate as defineStoryUpdateImpl,
} from './define-story';
import type { MapiStory, Story, StoryComponent, StoryCreate, StoryUpdate } from './define-story';

interface StoryblokTypesConfig {
  components: Block;
}

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
 * @example
 * ```ts
 * import type { pageComponent, teaserComponent } from './schema';
 *
 * type StoryblokTypes = {
 *   components: typeof pageComponent | typeof teaserComponent;
 * };
 *
 * const { defineStory, defineMapiStory, defineStoryCreate, defineStoryUpdate } =
 *   createStoryHelpers().withTypes<StoryblokTypes>();
 * ```
 */
export function createStoryHelpers() {
  return {
    defineStory: defineStoryImpl,
    defineMapiStory: defineMapiStoryImpl,
    defineStoryCreate: defineStoryCreateImpl,
    defineStoryUpdate: defineStoryUpdateImpl,
    withTypes<T extends StoryblokTypesConfig>() {
      const defineStory: DefineStoryTyped<T['components']> = (component, story) =>
        defineStoryImpl(component, story as any);

      const defineMapiStory: DefineMapiStoryTyped<T['components']> = (component, story) =>
        defineMapiStoryImpl(component, story as any);

      const defineStoryCreate: DefineStoryCreateTyped<T['components']> = (component, story) =>
        defineStoryCreateImpl(component, story as any);

      const defineStoryUpdate: DefineStoryUpdateTyped<T['components']> = (component, story) =>
        defineStoryUpdateImpl(component, story as any);

      return { defineStory, defineMapiStory, defineStoryCreate, defineStoryUpdate };
    },
  };
}

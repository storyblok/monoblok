import type { Block } from '../../helpers/define-block';
import {
  defineStoryCreate as defineStoryCreateImpl,
  defineStory as defineStoryImpl,
  defineStoryUpdate as defineStoryUpdateImpl,
} from './define-story';
import type { Story, StoryComponent, StoryCreate, StoryUpdate } from './define-story';

interface StoryblokTypesConfig {
  components: Block;
}

type DefineStoryTyped<TBlocks extends Block> =
  <const TBlock extends StoryComponent>(
    component: TBlock,
    story: Parameters<typeof defineStoryImpl<TBlock, TBlocks>>[1],
  ) => Story<TBlock, TBlocks>;

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
 * const { defineStory, defineStoryCreate, defineStoryUpdate } =
 *   createStoryHelpers().withTypes<StoryblokTypes>();
 * ```
 */
export function createStoryHelpers() {
  return {
    defineStory: defineStoryImpl,
    defineStoryCreate: defineStoryCreateImpl,
    defineStoryUpdate: defineStoryUpdateImpl,
    withTypes<T extends StoryblokTypesConfig>() {
      // Typed wrappers — delegate to the real implementations.
      // The `story` parameter assertion is targeted to the narrowest scope;
      // return-type safety is preserved by the explicit typed annotations.
      const defineStory: DefineStoryTyped<T['components']> = (component, story) =>
        defineStoryImpl(component, story as any);

      const defineStoryCreate: DefineStoryCreateTyped<T['components']> = (component, story) =>
        defineStoryCreateImpl(component, story as any);

      const defineStoryUpdate: DefineStoryUpdateTyped<T['components']> = (component, story) =>
        defineStoryUpdateImpl(component, story as any);

      return { defineStory, defineStoryCreate, defineStoryUpdate };
    },
  };
}

import type { Block } from './define-block';
import { defineStory as defineStoryImpl } from './define-story';
import type { Story, StoryComponent } from './define-story';

interface StoryblokTypesConfig {
  components: Block;
}

type DefineStoryTyped<TBlocks extends Block> =
  <const TBlock extends StoryComponent>(
    component: TBlock,
    story: Parameters<typeof defineStoryImpl<TBlock, TBlocks>>[1],
  ) => Story<TBlock, TBlocks>;

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
 * const { defineStory } = createStoryHelpers().withTypes<StoryblokTypes>();
 * ```
 */
export function createStoryHelpers() {
  return {
    defineStory: defineStoryImpl,
    withTypes<T extends StoryblokTypesConfig>() {
      // Typed wrapper — delegates to the real implementation.
      // The `story` parameter assertion is targeted to the narrowest scope;
      // return-type safety is preserved by the explicit `DefineStoryTyped` annotation.
      const defineStory: DefineStoryTyped<T['components']> = (component, story) =>
        defineStoryImpl(component, story as any);

      return { defineStory };
    },
  };
}

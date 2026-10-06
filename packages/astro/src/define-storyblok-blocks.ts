import StoryblokBlock from "./components/StoryblokBlock.astro";
import StoryblokBlocks from "./components/StoryblokBlocks.astro";
import { setBlocks } from "./registry";
import type { DefineStoryblokBlocksOptions } from "./types";

/**
 * Registers the components that render Storyblok blocks and returns the
 * components used to render them.
 *
 * @example
 * ```astro
 * ---
 * import { defineStoryblokBlocks } from '@storyblok/astro';
 * import Page from '~/components/Page.astro';
 * import Teaser from '~/components/Teaser.astro';
 * import Fallback from '~/components/Fallback.astro';
 *
 * const { StoryblokBlock, StoryblokBlocks } = defineStoryblokBlocks({
 *   components: { page: Page, teaser: Teaser },
 *   fallback: Fallback,
 * });
 * ---
 *
 * <StoryblokBlock block={story.content} />
 * <StoryblokBlocks blocks={block.body} />
 * ```
 */
export function defineStoryblokBlocks(options: DefineStoryblokBlocksOptions = {}) {
  setBlocks({
    components: options.components ?? {},
    fallback: options.fallback,
  });

  return { StoryblokBlock, StoryblokBlocks };
}

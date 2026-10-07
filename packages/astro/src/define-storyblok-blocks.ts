import { createComponent, render, renderComponent } from "astro/runtime/server/index.js";
import RawStoryblokBlock from "./components/StoryblokBlock.astro";
import type {
  DefineStoryblokBlocksOptions,
  DefineStoryblokBlocksResult,
  StoryblokBlockComponent,
} from "./types";

/**
 * Registers the components that render Storyblok blocks and returns a
 * `StoryblokBlock` component bound to them.
 *
 * Each call is fully independent: nothing is shared globally, so you can
 * define as many registries as you like (e.g. one per content area) without
 * them overwriting each other.
 *
 * @example
 * ```astro
 * ---
 * import { defineStoryblokBlocks } from '@storyblok/astro';
 * import Page from '~/components/Page.astro';
 * import Teaser from '~/components/Teaser.astro';
 * import Fallback from '~/components/Fallback.astro';
 *
 * const { StoryblokBlock } = defineStoryblokBlocks({
 *   components: { page: Page, teaser: Teaser },
 *   fallback: Fallback,
 * });
 * ---
 *
 * <StoryblokBlock block={story.content} />
 * {block.body?.map((child) => <StoryblokBlock block={child} />)}
 * ```
 *
 * @example Extra props shared by every registered component
 * ```astro
 * ---
 * import { defineStoryblokBlocks } from '@storyblok/astro';
 * import Branch from '~/components/Branch.astro';
 * import Leaf from '~/components/Leaf.astro';
 *
 * type ExtraComponentProps = { locale: string };
 *
 * const { StoryblokBlock } = defineStoryblokBlocks<ExtraComponentProps>({
 *   components: { branch: Branch, leaf: Leaf },
 * });
 * ---
 *
 * <StoryblokBlock block={root} locale="fr" />
 * ```
 */
export function defineStoryblokBlocks<TExtraProps extends object = {}>(
  options: DefineStoryblokBlocksOptions = {},
): DefineStoryblokBlocksResult<TExtraProps> {
  const components = options.components ?? {};
  const fallback = options.fallback;

  // `StoryblokBlock.astro` is compiled like any other Astro component, so it
  // can't be parameterized by calling it — there's no instance to bind
  // `components`/`fallback` to. We build a thin wrapper with Astro's own
  // low-level render primitives instead — the same `createComponent`/`render`
  // pair the Astro compiler itself targets — closing over this call's
  // registry so multiple `defineStoryblokBlocks()` calls never share state.
  const StoryblokBlock = createComponent(
    (result, props, slots) =>
      render`${renderComponent(
        result,
        "StoryblokBlock",
        RawStoryblokBlock,
        { ...props, components, fallback },
        slots,
      )}`,
  );

  return { StoryblokBlock: StoryblokBlock as StoryblokBlockComponent<TExtraProps> };
}

import { createComponent, render, renderComponent } from "astro/compiler-runtime";
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
 * Takes a factory rather than the options object directly: block components
 * often import `StoryblokBlock` back from this same registry (to recurse
 * into `body` fields), making this an import cycle. A factory defers
 * reading `components` until the first render, by which point the cycle has
 * finished initializing.
 *
 * @example
 * ```astro
 * ---
 * import { defineStoryblokBlocks } from '@storyblok/astro';
 * import Page from '~/components/Page.astro';
 * import Teaser from '~/components/Teaser.astro';
 * import Fallback from '~/components/Fallback.astro';
 *
 * const { StoryblokBlock } = defineStoryblokBlocks(() => ({
 *   components: { page: Page, teaser: Teaser },
 *   fallback: Fallback,
 * }));
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
 * const { StoryblokBlock } = defineStoryblokBlocks<ExtraComponentProps>(() => ({
 *   components: { branch: Branch, leaf: Leaf },
 * }));
 * ---
 *
 * <StoryblokBlock block={root} locale="fr" />
 * ```
 */
export function defineStoryblokBlocks<TExtraProps extends object = {}>(
  factory: () => DefineStoryblokBlocksOptions,
): DefineStoryblokBlocksResult<TExtraProps> {
  // Cached after the first call so a factory with side effects (e.g. logging)
  // only ever runs once, no matter how many blocks render.
  let resolved: DefineStoryblokBlocksOptions | undefined;
  const getComponents = () => (resolved ??= factory()).components ?? {};
  const getFallback = () => (resolved ??= factory()).fallback;

  // `StoryblokBlock.astro` can't be parameterized by calling it directly, so
  // this wraps it with Astro's own low-level render primitives, closing over
  // this call's registry so multiple `defineStoryblokBlocks()` calls never
  // share state.
  const StoryblokBlock = createComponent(
    (result, props, slots) =>
      render`${renderComponent(
        result,
        "StoryblokBlock",
        RawStoryblokBlock,
        // Namespaced so a user-declared `components`/`fallback` extra prop
        // doesn't collide with the registry.
        {
          ...props,
          __storyblokComponents: getComponents(),
          __storyblokFallback: getFallback(),
        },
        slots,
      )}`,
  );

  return { StoryblokBlock: StoryblokBlock as StoryblokBlockComponent<TExtraProps> };
}

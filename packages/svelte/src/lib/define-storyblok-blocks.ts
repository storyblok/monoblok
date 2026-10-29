import type { Component } from "svelte";
import RawStoryblokBlock from "./components/StoryblokBlock.svelte";
import type {
  DefineStoryblokBlocksOptions,
  DefineStoryblokBlocksResult,
  StoryblokBlockProps,
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
 * into `body` fields), making this an import cycle. A factory defers reading
 * `components` until the first render, by which point the cycle has
 * finished initializing.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { defineStoryblokBlocks } from '@storyblok/svelte';
 *   import Page from '$lib/blocks/Page.svelte';
 *   import Teaser from '$lib/blocks/Teaser.svelte';
 *   import Fallback from '$lib/blocks/Fallback.svelte';
 *
 *   const { StoryblokBlock } = defineStoryblokBlocks(() => ({
 *     components: { page: Page, teaser: Teaser },
 *     fallback: Fallback,
 *   }));
 * </script>
 *
 * <StoryblokBlock block={story.content} />
 * ```
 *
 * @example Extra props shared by every registered component
 * ```svelte
 * <script lang="ts">
 *   import { defineStoryblokBlocks } from '@storyblok/svelte';
 *   import Branch from '$lib/blocks/Branch.svelte';
 *   import Leaf from '$lib/blocks/Leaf.svelte';
 *
 *   type ExtraComponentProps = { locale: string };
 *
 *   const { StoryblokBlock } = defineStoryblokBlocks<ExtraComponentProps>(() => ({
 *     components: { branch: Branch, leaf: Leaf },
 *   }));
 * </script>
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

  // A Svelte component is just a `(internals, props) => exports` function
  // (see svelte's `Component` type), so it's wrapped directly instead of
  // going through a `.svelte` file. The wrapper proxies `props` rather than
  // spreading it, preserving the live getters Svelte's compiler generates
  // for the caller's props (e.g. `block`) so reactivity keeps working.
  const StoryblokBlock = ((internals: unknown, props: object) => {
    const proxiedProps = new Proxy(props, {
      get(target, key, receiver) {
        if (key === "__storyblokComponents") return getComponents();
        if (key === "__storyblokFallback") return getFallback();
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        return (
          key === "__storyblokComponents" ||
          key === "__storyblokFallback" ||
          Reflect.has(target, key)
        );
      },
    });

    return (RawStoryblokBlock as unknown as (internals: unknown, props: unknown) => unknown)(
      internals,
      proxiedProps,
    );
  }) as Component<StoryblokBlockProps<TExtraProps>>;

  return { StoryblokBlock };
}

import type { Component, ComponentProps } from "svelte";
import RawStoryblokBlock, {
  REGISTRY_PROP,
  type RawStoryblokBlockProps,
  type StoryblokBlockRegistry,
} from "./components/StoryblokBlock.svelte";
import RawStoryblokRichText from "./components/StoryblokRichText.svelte";
import StoryblokRichTextBlok from "./components/StoryblokRichTextBlok.svelte";
import type {
  StoryblokSvelteRichTextComponentMap,
  StoryblokSvelteRichTextProps,
} from "./richtext-helpers";
import type {
  DefineStoryblokBlocksOptions,
  DefineStoryblokBlocksResult,
  StoryblokBlockProps,
  StoryblokExtraProps,
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
export function defineStoryblokBlocks<TExtraProps extends StoryblokExtraProps = {}>(
  // `NoInfer` makes `TExtraProps` come from the type argument only. Inferred
  // from the registered components, it would accept any of them.
  factory: () => DefineStoryblokBlocksOptions<NoInfer<TExtraProps>>,
): DefineStoryblokBlocksResult<TExtraProps> {
  // Cached after the first call so a factory with side effects (e.g. logging)
  // only ever runs once, no matter how many blocks render.
  let resolved: DefineStoryblokBlocksOptions<TExtraProps> | undefined;
  const options = () => (resolved ??= factory());
  // Warnings already printed, so the Visual Editor's frequent re-renders
  // don't repeat the same warning for every update.
  const warned = new Set<string>();
  const registry: StoryblokBlockRegistry = {
    resolve: (name) => {
      const { components = {}, fallback } = options();
      // Own properties only, so a block type such as `constructor` doesn't
      // resolve to an `Object.prototype` member.
      return (Object.hasOwn(components, name) ? components[name] : undefined) ?? fallback;
    },
    warn: (key, message) => {
      if (options().warnings === false || warned.has(key)) return;
      warned.add(key);
      console.warn(message);
    },
  };

  // A Svelte component is just a `(internals, props) => exports` function
  // (see svelte's `Component` type), so it's wrapped directly instead of
  // going through a `.svelte` file. The wrapper proxies `props` rather than
  // spreading it, preserving the live getters Svelte's compiler generates
  // for the caller's props (e.g. `block`) so reactivity keeps working.
  // No cast here: if `StoryblokBlock.svelte` requires a prop that neither the
  // caller's props nor `withRegistry` supply, this stops compiling.
  const StoryblokBlock: Component<StoryblokBlockProps<TExtraProps>> = (internals, props) =>
    RawStoryblokBlock(internals, withRegistry(props, registry));

  // Renders embedded rich text bloks through this registry.
  const Blok: Component<StoryblokSvelteRichTextProps<"blok">> = (internals, props) =>
    StoryblokRichTextBlok(internals, withRegistry(props, registry));

  const StoryblokRichText: Component<ComponentProps<typeof RawStoryblokRichText>> = (
    internals,
    props,
  ) => RawStoryblokRichText(internals, withDefaultBlok(props, Blok));

  return { StoryblokBlock, StoryblokRichText };
}

/**
 * Adds `blok` to the `components` prop, unless the caller passes their own,
 * without copying `props` (see `withRegistry`).
 */
function withDefaultBlok<TProps extends { components?: StoryblokSvelteRichTextComponentMap }>(
  props: TProps,
  Blok: Component<StoryblokSvelteRichTextProps<"blok">>,
): TProps {
  // Cached per `components` value, so an unchanged prop keeps its identity
  // and doesn't make the rich text rerender.
  let cachedFor: StoryblokSvelteRichTextComponentMap | undefined;
  let cached: StoryblokSvelteRichTextComponentMap | undefined;
  return new Proxy(props, {
    get: (target, key, receiver) => {
      if (key !== "components") return Reflect.get(target, key, receiver);
      const components = target.components;
      if (!cached || components !== cachedFor) {
        cachedFor = components;
        cached = { blok: Blok, ...components };
      }
      return cached;
    },
    has: (target, key) => key === "components" || Reflect.has(target, key),
  });
}

/**
 * Adds the registry prop to `props` without copying them, so the live getters
 * Svelte's compiler generates for the caller's props keep working.
 */
function withRegistry<TProps extends object>(
  props: TProps,
  registry: StoryblokBlockRegistry,
): TProps & Pick<RawStoryblokBlockProps, typeof REGISTRY_PROP> {
  // A proxy keeps its target's type, so the one prop it adds is asserted.
  // The assertion covers only that prop: everything else is still checked
  // where the result is passed to `StoryblokBlock.svelte`.
  return new Proxy(props, {
    get: (target, key, receiver) =>
      key === REGISTRY_PROP ? registry : Reflect.get(target, key, receiver),
    has: (target, key) => key === REGISTRY_PROP || Reflect.has(target, key),
  }) as TProps & Pick<RawStoryblokBlockProps, typeof REGISTRY_PROP>;
}

import type { Component } from "svelte";
import RawStoryblokBlock, {
  REGISTRY_PROP,
  type RawStoryblokBlockProps,
  type StoryblokBlockRegistry,
} from "./components/StoryblokBlock.svelte";
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
  // `any` so the registry doesn't care which extra props the components take:
  // the `factory` signature already checked them.
  let resolved: DefineStoryblokBlocksOptions<any> | undefined;
  const options = (): DefineStoryblokBlocksOptions<any> => (resolved ??= factory());
  // Warnings already printed, so the Visual Editor's frequent re-renders
  // don't repeat the same warning for every update.
  const warned = new Set<string>();
  const warn: StoryblokBlockRegistry["warn"] = (key, message) => {
    if (options().warnings === false || warned.has(key)) return;
    warned.add(key);
    console.warn(message);
  };
  const registry: StoryblokBlockRegistry = {
    resolve: (name) => {
      const { components = {}, fallback } = options();
      // Own properties only, so a block type such as `constructor` doesn't
      // resolve to an `Object.prototype` member.
      const registered = Object.hasOwn(components, name) ? components[name] : undefined;

      // Svelte 5 components are plain functions.
      if (typeof registered === "function") return registered;
      if (Object.hasOwn(components, name)) {
        warn(
          `invalid:${name}`,
          `[storyblok] The component registered for block type "${name}" isn't a valid component. ` +
            "Check that it's imported as a default import (`import Teaser from './Teaser.svelte'`) " +
            "and isn't `undefined`, e.g. because of a circular import.",
        );
      }

      if (fallback) {
        if (typeof fallback === "function") return fallback;
        warn(
          "invalid-fallback",
          "[storyblok] The `fallback` passed to `defineStoryblokBlocks` isn't a valid component. " +
            "Check that it's imported as a default import and isn't `undefined`.",
        );
        return undefined;
      }

      if (!Object.hasOwn(components, name)) {
        // Content editors can add block types the code doesn't know about, so
        // this warns by default: otherwise the content silently goes missing.
        warn(
          `missing:${name}`,
          `[storyblok] No component registered for block type "${name}". ` +
            "Register it in `defineStoryblokBlocks(() => ({ components }))` or provide a `fallback`.",
        );
      }
      return undefined;
    },
    warn,
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

  return { StoryblokBlock };
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

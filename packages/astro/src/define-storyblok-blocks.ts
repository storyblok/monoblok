import { createComponent, render, renderComponent } from "astro/compiler-runtime";
import { createBlockRegistry, REGISTRY_PROP } from "./block-registry";
import RawStoryblokBlock from "./components/StoryblokBlock.astro";
import RawStoryblokRichText from "./components/StoryblokRichText.astro";
import StoryblokRichTextBlok from "./components/StoryblokRichTextBlok.astro";
import type {
  DefineStoryblokBlocksOptions,
  DefineStoryblokBlocksResult,
  StoryblokExtraProps,
} from "./types";

/**
 * Registers the components that render Storyblok blocks and returns a
 * `StoryblokBlock` and a `StoryblokRichText` bound to them.
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
 * ```ts
 * // src/storyblok.ts
 * import { defineStoryblokBlocks } from '@storyblok/astro';
 * import Page from './components/Page.astro';
 * import Teaser from './components/Teaser.astro';
 * import Fallback from './components/Fallback.astro';
 *
 * export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks(() => ({
 *   components: { page: Page, teaser: Teaser },
 *   fallback: Fallback,
 * }));
 * ```
 *
 * ```astro
 * <StoryblokBlock block={story.content} />
 * {block.body?.map((child) => <StoryblokBlock block={child} />)}
 * <StoryblokRichText document={block.text} />
 * ```
 *
 * @example Extra props shared by every registered component
 * ```ts
 * import { defineStoryblokBlocks } from '@storyblok/astro';
 * import Branch from './components/Branch.astro';
 * import Leaf from './components/Leaf.astro';
 *
 * type ExtraComponentProps = { locale: string };
 *
 * export const { StoryblokBlock } = defineStoryblokBlocks<ExtraComponentProps>(() => ({
 *   components: { branch: Branch, leaf: Leaf },
 * }));
 * ```
 *
 * ```astro
 * <StoryblokBlock block={root} locale="fr" />
 * ```
 */
export function defineStoryblokBlocks<TExtraProps extends StoryblokExtraProps = {}>(
  // `NoInfer` makes `TExtraProps` come from the type argument only. Inferred
  // from the registered components, it would accept any of them.
  factory: () => DefineStoryblokBlocksOptions<NoInfer<TExtraProps>>,
): DefineStoryblokBlocksResult<TExtraProps> {
  const registry = createBlockRegistry(factory);

  // `.astro` components can't be parameterized by calling them directly, so
  // these wrap them with Astro's own low-level render primitives, closing
  // over this call's registry so multiple `defineStoryblokBlocks()` calls
  // never share state.
  const StoryblokBlock = createComponent(
    (result, props, slots) =>
      render`${renderComponent(
        result,
        "StoryblokBlock",
        RawStoryblokBlock,
        { ...props, [REGISTRY_PROP]: registry },
        slots,
      )}`,
  );

  // Renders embedded rich text bloks through this registry.
  const Blok = createComponent(
    (result, props, slots) =>
      render`${renderComponent(
        result,
        "StoryblokRichTextBlok",
        StoryblokRichTextBlok,
        { ...props, [REGISTRY_PROP]: registry },
        slots,
      )}`,
  );

  // A caller's own `components.blok` replaces the registry-bound one; an
  // explicit `undefined` (e.g. `blok: cond ? Custom : undefined`) keeps it.
  const StoryblokRichText = createComponent(
    (result, props, slots) =>
      render`${renderComponent(
        result,
        "StoryblokRichText",
        RawStoryblokRichText,
        { ...props, components: { ...props.components, blok: props.components?.blok ?? Blok } },
        slots,
      )}`,
  );

  // `createComponent` always returns the untyped `AstroComponentFactory`
  // shape, so the props each wrapper accepts are asserted here. The same
  // `(props) => any` call signature is how Astro types `.astro` imports.
  return {
    StoryblokBlock: StoryblokBlock as DefineStoryblokBlocksResult<TExtraProps>["StoryblokBlock"],
    StoryblokRichText:
      StoryblokRichText as DefineStoryblokBlocksResult<TExtraProps>["StoryblokRichText"],
  };
}

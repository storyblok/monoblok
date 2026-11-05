import { createComponent, render, renderComponent } from "astro/compiler-runtime";
import { isInEditor, storyblokEditable } from "@storyblok/live-preview";
import { createBlockRegistry, type StoryblokBlockRegistry } from "./block-registry";
import { RawStoryblokRichText } from "./head-propagation";
import type { StoryblokAstroRichTextProps } from "./richtext-helpers";
import type {
  DefineStoryblokBlocksOptions,
  DefineStoryblokBlocksResult,
  StoryblokBlockData,
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
  // these are built with Astro's own low-level render primitives, closing
  // over this call's registry so multiple `defineStoryblokBlocks()` calls
  // never share state.
  //
  // Each is flagged `in-tree` and renders the resolved block itself, with no
  // `.astro` hop in between, so a block's head content (e.g. the scoped
  // styles of an MDX `<Content />` it renders) still reaches `<head>`. See
  // `head-propagation.ts`.
  const StoryblokBlock = createComponent({
    factory: (result: any, props: Record<string, any>, slots: any) =>
      render`${renderBlock(result, registry, props, slots)}`,
    propagation: "in-tree",
  });

  // Renders embedded rich text bloks through this registry.
  const Blok = createComponent({
    factory: (result: any, props: StoryblokAstroRichTextProps<"blok">) => {
      const { attrs, context } = props;
      const blocks = (Array.isArray(attrs?.body) ? attrs.body : []).filter(
        (block: unknown): block is StoryblokBlockData =>
          typeof block === "object" &&
          block !== null &&
          typeof Reflect.get(block, "component") === "string",
      );

      // A plain-object `data` passed to `StoryblokRichText` is forwarded to
      // every embedded block as extra props, like the extra props
      // `StoryblokBlock` passes to a block it renders directly.
      const data = context?.data;
      const extraProps =
        typeof data === "object" && data !== null && !Array.isArray(data) ? data : {};

      // `warnings={false}` on `StoryblokRichText` also silences the
      // registry's warnings for the embedded blocks it renders.
      const blockRegistry = context?.warnings === false ? registry.withoutWarnings() : registry;

      return render`${blocks.map((block) =>
        renderBlock(result, blockRegistry, { ...extraProps, block }, {}),
      )}`;
    },
    propagation: "in-tree",
  });

  // A caller's own `components.blok` replaces the registry-bound one; an
  // explicit `undefined` (e.g. `blok: cond ? Custom : undefined`) keeps it.
  const StoryblokRichText = createComponent({
    factory: (result: any, props: Record<string, any>, slots: any) =>
      render`${renderComponent(
        result,
        "StoryblokRichText",
        RawStoryblokRichText,
        { ...props, components: { ...props.components, blok: props.components?.blok ?? Blok } },
        slots,
      )}`,
    propagation: "in-tree",
  });

  // `createComponent` always returns the untyped `AstroComponentFactory`
  // shape, so the props each wrapper accepts are asserted here. The same
  // `(props) => any` call signature is how Astro types `.astro` imports.
  return {
    StoryblokBlock: StoryblokBlock as DefineStoryblokBlocksResult<TExtraProps>["StoryblokBlock"],
    StoryblokRichText:
      StoryblokRichText as DefineStoryblokBlocksResult<TExtraProps>["StoryblokRichText"],
  };
}

/**
 * Renders `props.block` with the component `registry` resolves for it,
 * passing the remaining props through as extra props.
 */
function renderBlock(
  result: any,
  registry: StoryblokBlockRegistry,
  props: Record<string, any>,
  slots: any,
): unknown {
  const { block, ...rest } = props;

  // Skipped in the Visual Editor, where the bridge sends a story without
  // `content` while the editor shows a previous version (visual history).
  if (!block && !isInEditor(new URL(result.request.url))) {
    registry.warn(
      "undefined-block",
      "[storyblok] <StoryblokBlock /> received an undefined `block` prop and rendered nothing. " +
        "Check that the value you're passing in exists, e.g. `story?.content` when the fetch " +
        "may have failed, or a typo in the prop name (`block`, not `blok`).",
    );
  }

  const Component = block ? registry.resolve(block.component) : undefined;
  if (!Component) return "";

  // `rest` first, so an untyped extra prop (e.g. from rich text `data`) can't
  // replace the injected `block` or `editable`.
  return renderComponent(
    result,
    "StoryblokBlock",
    Component,
    { ...rest, block, editable: storyblokEditable(block) },
    slots,
  );
}

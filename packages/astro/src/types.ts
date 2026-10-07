import { storyblokEditable } from "@storyblok/live-preview";
import type { AstroComponentFactory } from "astro/runtime/server/render/astro/index.js";

/**
 * A content block as returned by the Storyblok Content Delivery API.
 *
 * Every block carries a `component` field holding the technical name of the
 * Storyblok block, which is the key used to look up its renderer.
 */
export type StoryblokBlockData<T extends Record<string, any> = Record<string, any>> = T & {
  _uid?: string;
  component: string;
  _editable?: string;
};

/**
 * Editable attributes for the Visual Editor, as returned by
 * `storyblokEditable(block)`. Spread onto the component's root element.
 */
export type StoryblokEditableProps = ReturnType<typeof storyblokEditable>;

/**
 * Props received by a component registered in `defineStoryblokBlocks`.
 *
 * `T` describes the block's own fields, `TExtraProps` any additional props the
 * component accepts. `TExtraProps` controls its own optionality: mark a
 * field optional there (`showCount?: boolean`) if callers may omit it, or
 * required (`locale: string`) to make every `StoryblokBlock` usage supply it.
 *
 * @example
 * ```astro
 * ---
 * import type { StoryblokBlockComponentProps } from '@storyblok/astro';
 *
 * type Props = StoryblokBlockComponentProps<
 *   { headline: string },
 *   { showCount?: boolean }
 * >;
 * const { block, editable, showCount } = Astro.props as Props;
 * ---
 *
 * <div {...editable}>{block.headline}</div>
 * ```
 */
export type StoryblokBlockComponentProps<
  T extends object = object,
  TExtraProps extends object = {},
> = {
  /** The block content being rendered. */
  block: StoryblokBlockData<T>;
  /** Editable attributes injected by `StoryblokBlock`. */
  editable?: StoryblokEditableProps;
} & TExtraProps;

/**
 * Any component capable of rendering a block. In practice an `.astro`
 * component, but framework components work too.
 */

export type StoryblokComponentMap = Record<string, AstroComponentFactory>;

/**
 * Props accepted by the `StoryblokBlock` component returned from
 * `defineStoryblokBlocks`. `TExtraProps` are the additional props declared
 * via `defineStoryblokBlocks<TExtraProps>()`; they're forwarded as-is to
 * whichever component renders the block. Whether they're required follows
 * `TExtraProps` itself: a required field there makes every `StoryblokBlock`
 * usage, including recursive ones, supply it.
 */
export type StoryblokBlockProps<TExtraProps extends object = {}> = {
  /** The block to render. */
  block?: StoryblokBlockData;
} & TExtraProps;

/**
 * An `AstroComponentFactory` carrying a `(props: Props) => any` call
 * signature so `.astro`/`.tsx` files type-check the props passed to it, the
 * same mechanism Astro's own framework integrations rely on. `createComponent`
 * itself can't express this: it always returns the untyped
 * `AstroComponentFactory` shape.
 */
export type StoryblokBlockComponent<TExtraProps extends object = {}> = ((
  props: StoryblokBlockProps<TExtraProps>,
) => any) &
  AstroComponentFactory;

export interface DefineStoryblokBlocksOptions {
  /**
   * Map of Storyblok technical block names to the components rendering them.
   *
   * @example { page: Page, teaser: Teaser }
   */
  components?: StoryblokComponentMap;

  /**
   * Rendered for block types that are not present in `components`. Receives
   * the same props as a registered component.
   */
  fallback?: AstroComponentFactory;
}

import { storyblokEditable } from "@storyblok/live-preview";

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
 * component accepts.
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
  /** Editable attributes injected by `StoryblokBlock`/`StoryblokBlocks`. */
  editable?: StoryblokEditableProps;
} & Partial<TExtraProps>;

/**
 * Any component capable of rendering a block. In practice an `.astro`
 * component, but framework components work too.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StoryblokBlockComponent = any;

export type StoryblokComponentMap = Record<string, StoryblokBlockComponent>;

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
  fallback?: StoryblokBlockComponent;
}

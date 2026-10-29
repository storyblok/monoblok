import type { Component } from "svelte";

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
 * Map of Storyblok technical block names to the components rendering them.
 */
export type StoryblokComponentMap = Record<string, Component<any>>;

/**
 * Props received by a component registered in `defineStoryblokBlocks`.
 *
 * `T` describes the block's own fields, `TExtraProps` any additional props
 * the component accepts.
 */
export type StoryblokBlockComponentProps<
  T extends object = object,
  TExtraProps extends object = {},
> = {
  /** The block content being rendered. */
  block: StoryblokBlockData<T>;
} & TExtraProps;

/** Props accepted by the `StoryblokBlock` component returned from `defineStoryblokBlocks`. */
export type StoryblokBlockProps<TExtraProps extends object = {}> = {
  /** The block to render. */
  block?: StoryblokBlockData;
} & TExtraProps;

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
  fallback?: Component<any>;
}

/** Return value of `defineStoryblokBlocks()`. */
export interface DefineStoryblokBlocksResult<TExtraProps extends object = {}> {
  /**
   * Renders a block using the components registered in this
   * `defineStoryblokBlocks()` call.
   *
   * ```svelte
   * <StoryblokBlock block={story.content} />
   * ```
   */
  StoryblokBlock: Component<StoryblokBlockProps<TExtraProps>>;
}

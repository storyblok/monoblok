import type { storyblokEditable } from "@storyblok/live-preview";
import type { Component, ComponentProps } from "svelte";
import type StoryblokRichTextComponent from "./components/StoryblokRichText.svelte";

/**
 * A content block as returned by the Storyblok Content Delivery API.
 *
 * Every block carries a `component` field holding the technical name of the
 * Storyblok block, which is the key used to look up its renderer.
 */
export type StoryblokBlockData<T extends object = Record<string, unknown>> = T & {
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
 * Extra props shared by every component of a registry. `block` and
 * `editable` are reserved: `StoryblokBlock` injects them.
 */
export type StoryblokExtraProps = object & { block?: never; editable?: never };

/**
 * A component that renders a Storyblok block: it accepts the props
 * `StoryblokBlock` passes, and requires no prop beyond `TExtraProps`.
 */
export type StoryblokBlockComponent<TExtraProps extends StoryblokExtraProps = {}> = Component<
  // `any` so components can narrow `block` to their own fields.
  StoryblokBlockComponentProps<any, TExtraProps>
>;

/**
 * Map of Storyblok technical block names to the components rendering them.
 */
export type StoryblokComponentMap<TExtraProps extends StoryblokExtraProps = {}> = Record<
  string,
  StoryblokBlockComponent<TExtraProps>
>;

/**
 * Props received by a component registered in `defineStoryblokBlocks`.
 *
 * `T` describes the block's own fields, `TExtraProps` any additional props
 * the component accepts.
 */
export type StoryblokBlockComponentProps<
  T extends object = Record<string, unknown>,
  TExtraProps extends StoryblokExtraProps = {},
> = {
  /** The block content being rendered. */
  block: StoryblokBlockData<T>;
  /** Editable attributes injected by `StoryblokBlock`. Spread onto the component's root element. */
  editable?: StoryblokEditableProps;
} & TExtraProps;

/** Props accepted by the `StoryblokBlock` component returned from `defineStoryblokBlocks`. */
export type StoryblokBlockProps<TExtraProps extends StoryblokExtraProps = {}> = {
  /**
   * The block to render. Optional so `story?.content` can be passed while the
   * story may be missing; an undefined block renders nothing and warns in
   * development.
   */
  block?: StoryblokBlockData;
} & TExtraProps;

export interface DefineStoryblokBlocksOptions<TExtraProps extends StoryblokExtraProps = {}> {
  /**
   * Map of Storyblok technical block names to the components rendering them.
   *
   * @example { page: Page, teaser: Teaser }
   */
  components?: StoryblokComponentMap<TExtraProps>;

  /**
   * Rendered for block types that are not present in `components`. Receives
   * the same props as a registered component.
   *
   * Without a fallback, an unregistered block type renders nothing and logs a
   * warning (see `warnings`). To report it elsewhere, provide a fallback that
   * does so.
   */
  fallback?: StoryblokBlockComponent<TExtraProps>;

  /**
   * Logs a warning when `StoryblokBlock` renders nothing: for an undefined
   * `block`, or for a block type with no registered component and no
   * `fallback`. Each warning prints once per registry. Set to `false` to
   * silence them.
   *
   * @default true
   */
  warnings?: boolean;
}

/** Return value of `defineStoryblokBlocks()`. */
export interface DefineStoryblokBlocksResult<TExtraProps extends StoryblokExtraProps = {}> {
  /**
   * Renders a block using the components registered in this
   * `defineStoryblokBlocks()` call.
   *
   * ```svelte
   * <StoryblokBlock block={story.content} />
   * ```
   */
  StoryblokBlock: Component<StoryblokBlockProps<TExtraProps>>;

  /**
   * Renders a rich text field. Embedded blocks render through this
   * registry, like `StoryblokBlock`. A `components.blok` renderer replaces
   * that, and a plain-object `data` is passed to every embedded block as
   * extra props. `data` isn't checked against `TExtraProps`: use
   * `satisfies` to check it.
   *
   * ```svelte
   * <StoryblokRichText document={block.text} data={{ locale } satisfies ExtraProps} />
   * ```
   */
  StoryblokRichText: Component<ComponentProps<typeof StoryblokRichTextComponent>>;
}

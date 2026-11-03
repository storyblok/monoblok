import { storyblokEditable } from "@storyblok/live-preview";
import type { BridgeParams } from "@storyblok/live-preview";
import type { StoryblokRichTextComponentProps } from "./richtext-helpers";

/**
 * Structural stand-in for Astro's own `AstroComponentFactory` (defined in
 * `astro/runtime/server/render/astro/factory.ts`). Importing that type
 * directly would pull it from Astro's private, unversioned `astro/runtime/*`
 * export path, so any real Astro component factory — the only thing this
 * package ever assigns here — satisfies this shape instead.
 */
export interface AstroComponentFactory {
  (result: any, props: any, slots: any): any;
  isAstroComponentFactory?: boolean;
  moduleId?: string;
}

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
 * Extra props shared by every component of a registry. `block` and
 * `editable` are reserved: `StoryblokBlock` injects them.
 */
export type StoryblokExtraProps = object & { block?: never; editable?: never };

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
 * const { block, editable, showCount } = Astro.props;
 * ---
 *
 * <div {...editable}>{block.headline}</div>
 * ```
 */
export type StoryblokBlockComponentProps<
  T extends object = object,
  TExtraProps extends StoryblokExtraProps = {},
> = {
  /** The block content being rendered. */
  block: StoryblokBlockData<T>;
  /** Editable attributes injected by `StoryblokBlock`. Spread onto the component's root element. */
  editable?: StoryblokEditableProps;
} & TExtraProps;

/**
 * A component that renders a Storyblok block: it accepts the props
 * `StoryblokBlock` passes, and requires no prop beyond `TExtraProps`.
 *
 * Must be an `.astro` component. A framework component (React, Vue, ...)
 * can't be registered directly: wrap it in an `.astro` component and apply
 * the `client:*` directive there.
 */
export type StoryblokBlockComponent<TExtraProps extends StoryblokExtraProps = {}> = (
  // `any` so components can narrow `block` to their own fields.
  props: StoryblokBlockComponentProps<any, TExtraProps>,
) => any;

/**
 * Map of Storyblok technical block names to the components rendering them.
 */
export type StoryblokComponentMap<TExtraProps extends StoryblokExtraProps = {}> = Record<
  string,
  StoryblokBlockComponent<TExtraProps>
>;

/**
 * Props accepted by the `StoryblokBlock` component returned from
 * `defineStoryblokBlocks`. `TExtraProps` are the additional props declared
 * via `defineStoryblokBlocks<TExtraProps>()`; they're forwarded as-is to
 * whichever component renders the block. Whether they're required follows
 * `TExtraProps` itself: a required field there makes every `StoryblokBlock`
 * usage, including recursive ones, supply it.
 */
export type StoryblokBlockProps<TExtraProps extends StoryblokExtraProps = {}> = {
  /**
   * The block to render. Optional so `story?.content` can be passed while the
   * story may be missing; an undefined block renders nothing and warns.
   */
  block?: StoryblokBlockData;
} & TExtraProps;

/** Props accepted by the `StoryblokPreview` component. */
export interface StoryblokPreviewProps {
  /** Options forwarded to the Preview Bridge constructor. */
  bridgeOptions?: BridgeParams;
  /** Debounce delay for consecutive input events. Defaults to 500ms. */
  debounceMs?: number;
  /**
   * Morphs the DOM as the editor types (`input` events), in addition to
   * reloading the page on save/publish. Defaults to `false`: the page only
   * reloads on save/publish, with no live DOM morphing.
   */
  liveUpdate?: boolean;
}

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
   * `block`, for a block type with no registered component and no
   * `fallback`, or for a component that isn't a valid Astro component. Each
   * warning prints once per registry. Set to `false` to silence them.
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
   * ```astro
   * <StoryblokBlock block={story.content} />
   * {block.body?.map((child) => <StoryblokBlock block={child} />)}
   * ```
   */
  // Inlined (not aliased to `StoryblokBlockProps`) so hovers show the real
  // props instead of just the type name. Keep both in sync.
  StoryblokBlock: (props: { block?: StoryblokBlockData } & TExtraProps) => any;

  /**
   * Renders a rich text field. Embedded blocks render through this
   * registry, like `StoryblokBlock`. A `components.blok` renderer replaces
   * that, and a plain-object `data` is passed to every embedded block as
   * extra props. `data` isn't checked against `TExtraProps`: use
   * `satisfies` to check it.
   *
   * ```astro
   * <StoryblokRichText document={block.text} data={{ locale } satisfies ExtraProps} />
   * ```
   */
  StoryblokRichText: (props: StoryblokRichTextComponentProps) => any;
}

import type { ComponentType, ReactNode } from "react";
import type { storyblokEditable } from "@storyblok/live-preview";
import type { StoryblokReactRichTextComponentProps } from "./richtext/renderer";
import type { BlockContent, BlockContentInput } from "./generated/types/field";
import type { Story } from "./generated/types/story";
import { Prettify } from "./generated/types/_utils";

/**
 * Attributes returned by `storyblokEditable` — spread onto the root element of a
 * block component to enable click-to-edit in the Visual Editor.
 *
 * When used via `StoryblokBlock`, this is injected automatically as the
 * `editable` prop; no manual import of `storyblokEditable` is required.
 *
 * @example
 * ```tsx
 * const Feature = ({ block, editable }: FeatureProps) => (
 *   <div {...editable}>…</div>
 * );
 * ```
 */
export type StoryblokEditableProps = ReturnType<typeof storyblokEditable>;

/**
 * Helper type for the props of a React component registered with
 * {@link defineStoryblokBlocks} and rendered via `StoryblokBlock`.
 *
 * `TExtraProps` mirrors the type argument passed to
 * {@link defineStoryblokBlocks} and controls its own optionality: mark a
 * field optional there (`showCount?: boolean`) if callers may omit it, or
 * required (`locale: string`) to make every `StoryblokBlock` usage supply it.
 *
 * @example
 * ```tsx
 * // Basic: type the block's own fields.
 * type PageProps = StoryblokBlockComponentProps<{ body: BlockContent[] }>;
 * function Page({ block, editable }: PageProps) { ... }
 *
 * // Using a schema defined with `@storyblok/schema`.
 * type TeaserProps = StoryblokBlockComponentProps<Block<"teaser">>;
 * function Teaser({ block, editable }: TeaserProps) { ... }
 *
 * // Advanced: type extra props too, matching defineStoryblokBlocks<{ locale: string }>(...):
 * type TeaserWithLocaleProps = StoryblokBlockComponentProps<Block<"teaser">, { locale: string }>;
 * function TeaserWithLocale({ block, editable, locale }: TeaserWithLocaleProps) { ... }
 * ```
 */
export type StoryblokBlockComponentProps<
  T extends object = object,
  TExtraProps extends StoryblokExtraProps = {},
> = {
  block: BlockContent & T;
  /** Editable attributes injected by `StoryblokBlock`. Spread onto the root element. */
  editable?: StoryblokEditableProps;
} & TExtraProps;

/**
 * Extra props shared by every component of a registry. `block` and
 * `editable` are reserved: `StoryblokBlock` injects them.
 */
export type StoryblokExtraProps = object & { block?: never; editable?: never };

/**
 * A component that renders a Storyblok block: it accepts the props
 * `StoryblokBlock` passes, and requires no prop beyond `TExtraProps`.
 */
export type StoryblokBlockComponent<TExtraProps extends StoryblokExtraProps = {}> = ComponentType<
  // `any` so components can narrow `block` to their own fields.
  StoryblokBlockComponentProps<any, TExtraProps>
>;

/**
 * A registered block: either a component, or a component with its own
 * Suspense options.
 */
export type StoryblokBlockEntry<TExtraProps extends StoryblokExtraProps = {}> =
  | StoryblokBlockComponent<TExtraProps>
  | {
      component: StoryblokBlockComponent<TExtraProps>;
      /** Custom fallback for this component's Suspense boundary (`<Skeleton />`). */
      fallback?: ReactNode;
      /** Whether to wrap in Suspense (auto-detected for lazy components, can be forced). */
      suspense?: boolean;
    };

/** Map of Storyblok technical block names to the components rendering them. */
export type StoryblokComponentMap<TExtraProps extends StoryblokExtraProps = {}> = Record<
  string,
  StoryblokBlockEntry<TExtraProps>
>;

/**
 * Props accepted by the `StoryblokBlock` component returned from
 * `defineStoryblokBlocks`. `TExtraProps` are forwarded as-is to whichever
 * component renders the block.
 */
export type StoryblokBlockProps<TExtraProps extends StoryblokExtraProps = {}> = {
  /**
   * The block to render. Optional so `story?.content` can be passed while the
   * story may be missing; an undefined block renders nothing and warns.
   */
  block?: StoryblokBlockData;
} & TExtraProps;

/** Options returned by the factory passed to `defineStoryblokBlocks`. */
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

  /** Default Suspense fallback for async components (`<GlobalSkeleton />`). */
  suspenseFallback?: ReactNode;

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
   * `defineStoryblokBlocks()` call. Extra props are checked against
   * `TExtraProps`, so a misspelled prop is a compile error.
   *
   * ```tsx
   * <StoryblokBlock block={story.content} />
   * ```
   */
  // Inlined (not aliased to `StoryblokBlockProps`) so hovers show the real props.
  StoryblokBlock: (props: { block?: StoryblokBlockData } & TExtraProps) => ReactNode;

  /**
   * Renders a rich text field. Embedded blocks render through this
   * registry, like `StoryblokBlock`. A `components.blok` renderer replaces
   * that, and a plain-object `data` is passed to every embedded block as
   * extra props. `data` isn't checked against `TExtraProps`: use
   * `satisfies` to check it.
   *
   * ```tsx
   * <StoryblokRichText document={block.text} data={{ locale } satisfies ExtraProps} />
   * ```
   */
  StoryblokRichText: (props: StoryblokReactRichTextComponentProps) => ReactNode;
}

export type { BlockContent, BlockContentInput, Story };

/**
 * The loosely-typed shape of a block's content: only `_uid`, `component`, and
 * `_editable` are known, plus an index signature for every other field.
 *
 * This is the type the `StoryblokBlock` registry itself
 * works with — it has to accept any block, so it can't know a block's
 * specific fields ahead of time. Contrast with {@link BlockContent}, the
 * fully-typed shape generated from a component's schema (via `@storyblok/schema`
 * or `StoryblokBlockComponentProps<T>`), which is what an individual block
 * component should type its own `block` prop with.
 */
export type StoryblokBlockData = Prettify<
  Pick<BlockContent, "_uid" | "component" | "_editable">
> & {
  [key: string]: unknown;
};

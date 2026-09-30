import type { storyblokEditable } from "@storyblok/live-preview";
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
 * {@link defineStoryblokBlocks} and rendered via `StoryblokBlock`/`StoryblokBlocks`.
 *
 * `TExtraProps` mirrors the type argument passed to
 * {@link defineStoryblokBlocks}, and is always optional here (`Partial`):
 * the registry can't guarantee every call site provides it, so a required
 * field would fail to register.
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
  TExtraProps extends object = {},
> = {
  block: BlockContent & T;
  /** Editable attributes injected by `StoryblokBlock`/`StoryblokBlocks`. Spread onto the root element. */
  editable?: StoryblokEditableProps;
} & Partial<TExtraProps>;

export type { BlockContent, BlockContentInput, Story };

/**
 * The loosely-typed shape of a block's content: only `_uid`, `component`, and
 * `_editable` are known, plus an index signature for every other field.
 *
 * This is the type the `StoryblokBlock`/`StoryblokBlocks` registry itself
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

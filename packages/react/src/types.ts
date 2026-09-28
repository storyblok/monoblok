import type { storyblokEditable } from "@storyblok/live-preview";
import type { BlockContent, BlockContentInput } from "./generated/types/field";
import type { Story } from "./generated/types/story";
import { Prettify } from "./generated/types/_utils";

/**
 * Attributes returned by `storyblokEditable` — spread onto the root element of a
 * block component to enable click-to-edit in the Visual Editor.
 *
 * When used via `StoryblokComponent`, this is injected automatically as the
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
 * Helper type for typed block component props.
 *
 * Naming note: kept as `StoryblokComponentProps`/`StoryblokComponent` rather
 * than `StoryblokBlock(s)` for 8.0 — renaming close to release risked
 * destabilizing the API surface further without a clear consensus on the
 * replacement name. Revisit before a future major if a rename is desired.
 *
 * `TExtraProps` mirrors the type argument passed to
 * {@link defineStoryblokComponents}, and is always optional here (`Partial`):
 * the registry can't guarantee every call site provides it, so a required
 * field would fail to register.
 *
 * @example
 * ```tsx
 * // Basic: type the block's own fields.
 * type PageProps = StoryblokComponentProps<{ body: BlockContent[] }>;
 * function Page({ block, editable }: PageProps) { ... }
 *
 * // Using a schema defined with `@storyblok/schema`.
 * type TeaserProps = StoryblokComponentProps<Block<"teaser">>;
 * function Teaser({ block, editable }: TeaserProps) { ... }
 *
 * // Advanced: type extra props too, matching defineStoryblokComponents<{ locale: string }>(...):
 * type TeaserWithLocaleProps = StoryblokComponentProps<Block<"teaser">, { locale: string }>;
 * function TeaserWithLocale({ block, editable, locale }: TeaserWithLocaleProps) { ... }
 * ```
 */
export type StoryblokComponentProps<T extends object = object, TExtraProps extends object = {}> = {
  block: BlockContent & T;
  /** Editable attributes injected by `StoryblokComponent`. Spread onto the root element. */
  editable?: StoryblokEditableProps;
} & Partial<TExtraProps>;

export type { BlockContent, BlockContentInput, Story };

export type StoryblokBlockData = Prettify<
  Pick<BlockContent, "_uid" | "component" | "_editable">
> & {
  [key: string]: unknown;
};

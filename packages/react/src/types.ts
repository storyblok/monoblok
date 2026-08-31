import type { storyblokEditable } from "@storyblok/live-preview";
import type { BlockContent } from "./generated/types/field";

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
 * @example
 * type PageProps = StoryblokComponentProps<{ body: BlockContent[] }>;
 * export default function Page({ block, editable }: PageProps) { ... }
 */
export interface StoryblokComponentProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  block: BlockContent & T;
  /**
   * Editable attributes injected by `StoryblokComponent`. Spread onto the root
   * element of the block to enable click-to-edit in the Visual Editor.
   *
   * @example
   * ```tsx
   * const Feature = ({ block, editable }: FeatureProps) => (
   *   <div {...editable}>{block.name}</div>
   * );
   * ```
   */
  editable?: StoryblokEditableProps;
}

export type { BlockContent };

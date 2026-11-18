import { type ReactNode, useMemo } from "react";
import { createRichTextRenderer } from "./renderer";
import type { StoryblokReactRichTextComponentProps } from "./renderer";

/**
 * Renders a Storyblok rich text field.
 *
 * Standalone: it isn't bound to a block registry, so apps that don't render
 * rich text don't bundle the renderer. Embedded bloks render only through
 * `components.blok`, which receives the node's `attrs`; render `attrs.body`
 * with your registry's `StoryblokBlock` to give them the app's components,
 * `editable` attributes and `fallback`. A document with a `blok` node and no
 * `components.blok` warns once, unless `warnings={false}`.
 *
 * `data` is passed to custom node and mark components as `context.data`.
 *
 * **Performance:** the rendered output is memoized and recomputed only when
 * `document`, `optimizeImage`, `components`, `data`, or `warnings` change by
 * reference. Pass stable references (module-level constants or values wrapped
 * in `useMemo`) for `components` and `data` to get cache hits across renders.
 *
 * @example
 * ```tsx
 * // rich-text-blok.tsx
 * import type { StoryblokReactRichTextProps } from "@storyblok/react";
 * import { StoryblokBlock } from "./storyblok";
 *
 * export function RichTextBlok({ attrs }: StoryblokReactRichTextProps<"blok">) {
 *   return attrs.body?.map((block) => <StoryblokBlock key={block._uid} block={block} />);
 * }
 *
 * // usage
 * <StoryblokRichText document={block.text} components={{ blok: RichTextBlok }} />
 * ```
 */
export function StoryblokRichText({
  document,
  optimizeImage,
  components,
  data,
  warnings,
}: StoryblokReactRichTextComponentProps): ReactNode {
  return useMemo(
    () => createRichTextRenderer({ optimizeImage, components, data, warnings })(document),
    [document, optimizeImage, components, data, warnings],
  );
}

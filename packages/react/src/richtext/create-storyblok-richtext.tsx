import { useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import { createRichTextRenderer } from "./renderer";
import type { StoryblokReactRichTextComponentProps, StoryblokReactRichTextProps } from "./renderer";
import type { BlockContent } from "../types";

/**
 * Returns a `StoryblokRichText` React component.
 *
 * When called without arguments it returns a standalone richtext renderer with
 * no embedded block support. Pass a `StoryblokComponent` to inject a default
 * `blok` renderer that delegates to it — this is what `defineStoryblokComponents`
 * uses internally.
 *
 * **Performance:** the rendered output is memoized and recomputed only when
 * `document`, `optimizeImage`, `components`, or `data` change by reference.
 * Pass stable references (module-level constants or values wrapped in
 * `useMemo`) for `components` and `data` to get cache hits across renders.
 * Inline object literals create a new reference on every render and defeat
 * the cache.
 */
export function createStoryblokRichText(
  StoryblokComponent?: ComponentType<{ block: BlockContent }>,
) {
  // Inlined from the deleted create-default-block.tsx (one call site).
  // Captured once per factory call — stable for the lifetime of the returned component.
  const DefaultBlock = StoryblokComponent
    ? function DefaultBlock({ attrs }: StoryblokReactRichTextProps<"blok">) {
        if (!Array.isArray(attrs?.body)) {
          return null;
        }
        return attrs.body.map((block) =>
          block._uid ? <StoryblokComponent block={block as BlockContent} key={block._uid} /> : null,
        );
      }
    : undefined;

  return function StoryblokRichText({
    document,
    optimizeImage,
    components,
    data,
  }: StoryblokReactRichTextComponentProps): ReactNode {
    // Memoize the rendered output so that the full document traversal
    // (normalizeNodes → addKeys → renderChildren) is skipped when none of
    // the inputs have changed. `document` must be in the deps so a story
    // update triggers a re-render. `DefaultBlock` is stable for the lifetime
    // of this component factory and is captured by closure; it does not need
    // to appear in the deps array.
    return useMemo(
      () =>
        createRichTextRenderer({
          optimizeImage,
          components: DefaultBlock ? { blok: DefaultBlock, ...components } : components,
          data,
        })(document),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [document, optimizeImage, components, data],
    );
  };
}

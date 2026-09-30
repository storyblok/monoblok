import { useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import { createRichTextRenderer } from "./renderer";
import type { StoryblokReactRichTextComponentProps, StoryblokReactRichTextProps } from "./renderer";
import type { StoryblokBlockData } from "../types";

function isStoryblokBlock(block: unknown): block is StoryblokBlockData {
  if (typeof block !== "object" || block === null) {
    return false;
  }

  const candidate = block as { _uid?: unknown; component?: unknown };
  return typeof candidate["_uid"] === "string" && typeof candidate.component === "string";
}

/**
 * Returns a `StoryblokRichText` React component.
 *
 * When called without arguments it returns a standalone richtext renderer with
 * no embedded block support. Pass a `StoryblokBlock` to inject a default
 * `blok` renderer that delegates to it — this is what `defineStoryblokBlocks`
 * uses internally.
 *
 * **Extra props for embedded blocks:** unlike `StoryblokBlock`, this
 * component cannot automatically forward extra props (e.g. `locale`) from an
 * enclosing `<StoryblokBlock block={page} locale="de" />` call down into
 * blocks embedded in `page`'s richtext fields — the two calls belong to
 * unrelated component trees, and threading it implicitly via React Context
 * would break Server Component usage (this module has no `"use client"`
 * directive so registered components can be async Server Components).
 * To forward props explicitly, pass them as `data` — the default `blok`
 * renderer spreads a plain-object `data` onto every embedded block:
 * ```tsx
 * <StoryblokRichText document={page.richtext} data={{ locale }} />
 * ```
 *
 * **Performance:** the rendered output is memoized and recomputed only when
 * `document`, `optimizeImage`, `components`, or `data` change by reference.
 * Pass stable references (module-level constants or values wrapped in
 * `useMemo`) for `components` and `data` to get cache hits across renders.
 * Inline object literals create a new reference on every render and defeat
 * the cache.
 */
export function createStoryblokRichText(
  StoryblokBlock?: ComponentType<{ block: StoryblokBlockData }>,
) {
  // Captured once per factory call — stable for the lifetime of the returned component.
  const DefaultBlock = StoryblokBlock
    ? function DefaultBlock({ attrs, context }: StoryblokReactRichTextProps<"blok">) {
        if (!Array.isArray(attrs?.body)) {
          return null;
        }
        // Opt-in prop forwarding: a plain-object `data` passed to StoryblokRichText
        // is spread onto every embedded block, mirroring the extra props
        // StoryblokBlock forwards to a block it renders directly.
        const extraProps =
          typeof context?.data === "object" && context.data !== null ? context.data : undefined;
        return attrs.body.map((block) =>
          isStoryblokBlock(block) ? (
            <StoryblokBlock block={block} key={block["_uid"]} {...extraProps} />
          ) : null,
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

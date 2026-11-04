import { useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import { createRichTextRenderer } from "./renderer";
import type { StoryblokReactRichTextComponentProps, StoryblokReactRichTextProps } from "./renderer";
import type { StoryblokBlockData } from "../types";

/**
 * Renders a block through a registry. Extra props are spread onto the
 * rendered component.
 */
type RegistryBlock = ComponentType<{ block: StoryblokBlockData } & Record<string, unknown>>;

/**
 * The `StoryblokBlock` of a registry, plus a variant of it with every
 * registry warning silenced (used when `warnings={false}` is passed to
 * `StoryblokRichText`).
 */
export type RichTextBlockRenderers = {
  StoryblokBlock: RegistryBlock;
  SilentStoryblokBlock: RegistryBlock;
};

function isStoryblokBlock(block: unknown): block is StoryblokBlockData {
  return (
    typeof block === "object" &&
    block !== null &&
    typeof Reflect.get(block, "component") === "string"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns a `StoryblokRichText` React component.
 *
 * When called without arguments it returns a standalone rich text renderer:
 * embedded bloks render only through `components.blok`, and warn otherwise
 * unless `warnings={false}`. Pass a registry's block renderers to inject a
 * default `blok` renderer that delegates to them — this is what
 * `defineStoryblokBlocks` uses internally.
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
 * `document`, `optimizeImage`, `components`, `data`, or `warnings` change by
 * reference. Pass stable references (module-level constants or values wrapped
 * in `useMemo`) for `components` and `data` to get cache hits across renders.
 * Inline object literals create a new reference on every render and defeat
 * the cache.
 */
export function createStoryblokRichText(
  blocks?: RichTextBlockRenderers,
): (props: StoryblokReactRichTextComponentProps) => ReactNode {
  // Captured once per factory call — stable for the lifetime of the returned component.
  const DefaultBlock = blocks
    ? function DefaultBlock({ attrs, context }: StoryblokReactRichTextProps<"blok">) {
        const body: unknown[] = Array.isArray(attrs?.body) ? attrs.body : [];
        // `warnings={false}` on `StoryblokRichText` also silences the
        // registry's warnings for the embedded blocks it renders.
        const Block =
          context?.warnings === false ? blocks.SilentStoryblokBlock : blocks.StoryblokBlock;
        // A plain-object `data` passed to `StoryblokRichText` is forwarded to
        // every embedded block as extra props, like the extra props
        // `StoryblokBlock` passes to a block it renders directly.
        const extraProps = isPlainObject(context?.data) ? context.data : {};
        return body.filter(isStoryblokBlock).map((block, index) => (
          // `StoryblokBlock` passes `block` after the extra props, so a
          // `data.block` can't replace the block.
          <Block {...extraProps} key={block._uid ?? index} block={block} />
        ));
      }
    : undefined;

  return function StoryblokRichText({
    document,
    optimizeImage,
    components,
    data,
    warnings,
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
          warnings,
        })(document),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [document, optimizeImage, components, data, warnings],
    );
  };
}

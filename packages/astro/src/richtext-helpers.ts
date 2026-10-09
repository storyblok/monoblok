import {
  processAttrs,
  type StoryblokRichTextElement,
  type StoryblokRichTextImageOptions,
  type StoryblokRichTextInput,
  type StoryblokRichTextProps,
  styleToString,
} from "@storyblok/richtext";
import type { AstroComponentFactory } from "astro/runtime/server/render/astro/index.js";

export type StoryblokAstroRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: AstroComponentFactory;
};

export interface StoryblokAstroRichTextRenderContext {
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokAstroRichTextComponentMap;
  data?: unknown;
}

export type StoryblokAstroRichTextProps<T extends StoryblokRichTextElement> = Omit<
  StoryblokRichTextProps<T>,
  "context" | "children"
> & {
  context?: StoryblokAstroRichTextRenderContext;
};

/** Props accepted by the `StoryblokRichText` component. */
export interface StoryblokRichTextComponentProps {
  /** The Storyblok rich text field to render. */
  document: StoryblokRichTextInput;
  /** Resolves `StoryblokRichTextImageOptions` or enables defaults when `true`. */
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  /** Overrides the default renderer for specific node/mark types. */
  components?: StoryblokAstroRichTextComponentMap;
  /** Arbitrary data forwarded to custom `components`. */
  data?: unknown;
}

/**
 * An `AstroComponentFactory` carrying a `(props: Props) => any` call
 * signature so `.astro`/`.tsx` files type-check the props passed to
 * `StoryblokRichText`, the same mechanism Astro's own framework
 * integrations rely on. `createComponent` itself can't express this: it
 * always returns the untyped `AstroComponentFactory` shape.
 */
export type StoryblokRichTextComponent = ((props: {
  document: StoryblokRichTextInput;
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokAstroRichTextComponentMap;
  data?: unknown;
}) => any) &
  AstroComponentFactory;

export function isValidAstroComponent(component: unknown): component is AstroComponentFactory {
  return (
    typeof component === "function" ||
    (typeof component === "object" && component !== null && "isAstroComponentFactory" in component)
  );
}

export function buildAstroAttrs(
  type: StoryblokRichTextElement,
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const processedAttrs = processAttrs(type, attrs, {
    colspan: "colspan",
    rowspan: "rowspan",
  });

  const styleObj = processedAttrs?.style as Record<string, unknown> | undefined;
  const finalAttrs: Record<string, unknown> = { ...processedAttrs };

  if (styleObj) {
    finalAttrs.style = styleToString(styleObj);
  }

  return finalAttrs;
}

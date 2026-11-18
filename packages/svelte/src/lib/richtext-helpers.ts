import {
  processAttrs,
  type StoryblokRichTextElement,
  type StoryblokRichTextImageOptions,
  type StoryblokRichTextInput,
  type StoryblokRichTextProps,
  styleToString,
} from "@storyblok/richtext";
import type { Component, Snippet } from "svelte";

export type StoryblokSvelteRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: Component<any>;
};

export interface StoryblokSvelteRichTextRenderContext {
  optimizeImage?: boolean | Partial<StoryblokRichTextImageOptions>;
  components?: StoryblokSvelteRichTextComponentMap;
  data?: unknown;
  /**
   * Logs a warning when a `blok` node has no `components.blok` renderer. Set
   * to `false` to silence it.
   *
   * @default true
   */
  warnings?: boolean;
}

/** Props accepted by the `StoryblokRichText` component. */
export interface StoryblokRichTextComponentProps {
  /** The Storyblok rich text field to render. */
  document: StoryblokRichTextInput;
  /** Resolves `StoryblokRichTextImageOptions` or enables defaults when `true`. */
  optimizeImage?: boolean | Partial<StoryblokRichTextImageOptions>;
  /** Overrides the default renderer for specific node/mark types. */
  components?: StoryblokSvelteRichTextComponentMap;
  /** Arbitrary data forwarded to custom `components`. */
  data?: unknown;
  /**
   * Logs a warning when a `blok` node has no `components.blok` renderer. Set
   * to `false` to silence it.
   *
   * @default true
   */
  warnings?: boolean;
}

export type StoryblokSvelteRichTextProps<T extends StoryblokRichTextElement> = Omit<
  StoryblokRichTextProps<T>,
  "context" | "children"
> & {
  context?: StoryblokSvelteRichTextRenderContext;
  children?: Snippet;
};

export function buildSvelteAttrs(
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

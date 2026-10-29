import {
  processAttrs,
  type StoryblokRichTextElement,
  type StoryblokRichTextImageOptions,
  type StoryblokRichTextProps,
  styleToString,
} from "@storyblok/richtext";
import type { Component, Snippet } from "svelte";

export type StoryblokSvelteRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: Component<any>;
};

export interface StoryblokSvelteRichTextRenderContext {
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokSvelteRichTextComponentMap;
  data?: unknown;
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

import type {
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextProps,
} from "@storyblok/richtext";
import type { Component, Snippet } from "svelte";

export type StoryblokSvelteRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: Component<any>;
};

/**
 * @deprecated Use {@link StoryblokSvelteRichTextComponentMap} instead. Will be removed in the next major version.
 */
export type SbSvelteRichTextComponentMap = StoryblokSvelteRichTextComponentMap;

export interface StoryblokSvelteRichTextRenderContext {
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokSvelteRichTextComponentMap;
  data?: unknown;
}

/**
 * @deprecated Use {@link StoryblokSvelteRichTextRenderContext} instead. Will be removed in the next major version.
 */
export type SbSvelteRichTextRenderContext = StoryblokSvelteRichTextRenderContext;

export type StoryblokSvelteRichTextProps<T extends StoryblokRichTextElement> = Omit<
  StoryblokRichTextProps<T>,
  "context" | "children"
> & {
  context?: StoryblokSvelteRichTextRenderContext;
  children?: Snippet;
};

/**
 * @deprecated Use {@link StoryblokSvelteRichTextProps} instead. Will be removed in the next major version.
 */
export type SbSvelteRichTextProps<T extends StoryblokRichTextElement> =
  StoryblokSvelteRichTextProps<T>;

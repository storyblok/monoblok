import type {
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextProps,
} from "@storyblok/richtext";
import type { AstroComponentFactory } from "astro/runtime/server/render/astro/index.js";

export type StoryblokAstroRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: AstroComponentFactory;
};

/**
 * @deprecated Use {@link StoryblokAstroRichTextComponentMap} instead. Will be removed in the next major version.
 */
export type SbAstroRichTextComponentMap = StoryblokAstroRichTextComponentMap;

export interface StoryblokAstroRichTextRenderContext {
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokAstroRichTextComponentMap;
  data?: unknown;
}
/**
 * @deprecated Use {@link StoryblokAstroRichTextRenderContext} instead. Will be removed in the next major version.
 */
export type SbAstroRichTextRenderContext = StoryblokAstroRichTextRenderContext;

export type StoryblokAstroRichTextProps<T extends StoryblokRichTextElement> = Omit<
  StoryblokRichTextProps<T>,
  "context" | "children"
> & {
  context?: StoryblokAstroRichTextRenderContext;
};
/**
 * @deprecated Use {@link StoryblokAstroRichTextProps} instead. Will be removed in the next major version.
 */
export type SbAstroRichTextProps<T extends StoryblokRichTextElement> =
  StoryblokAstroRichTextProps<T>;

export function isValidAstroComponent(component: unknown): component is AstroComponentFactory {
  return (
    typeof component === "function" ||
    (typeof component === "object" && component !== null && "isAstroComponentFactory" in component)
  );
}

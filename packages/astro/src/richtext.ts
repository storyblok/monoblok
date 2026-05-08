import type {
  StoryblokRichTextNode,
  StoryblokRichTextOptions,
} from '@storyblok/richtext';
import { richTextResolver } from '@storyblok/richtext';

/**
 * Render Rich Text using the default `@storyblok/richtext` resolver.
 *
 * Equivalent to `richTextResolver(options).render(data)`.
 */
export function renderRichText<T = string>(
  data: StoryblokRichTextNode<T>,
  options?: StoryblokRichTextOptions<T>,
): T | undefined {
  return richTextResolver(options).render(data);
}

export {
  asTag,
  BlockTypes,
  ComponentBlok,
  LinkTypes,
  MarkTypes,
  richTextResolver,
  segmentStoryblokRichText,
  TextTypes,
} from '@storyblok/richtext';

export type {
  StoryblokRichTextDocumentNode,
  StoryblokRichTextImageOptimizationOptions,
  StoryblokRichTextNode,
  StoryblokRichTextNodeTypes,
  StoryblokRichTextOptions,
} from '@storyblok/richtext';
